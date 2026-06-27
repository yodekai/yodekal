// server/game/Bot.js — simple AI fighter for spar practice
'use strict';
const C = require('../../shared/constants');
const { resolveWalls } = require('./Collision');

let BBID = 1;
let BOT_BID = 1;

const NAMES = ['Sentinel','Argus','Helios','Raze','Kira','Volt','Pyre','Spike','Nyx','Hex'];

class Bot {
  constructor(sparKey, spawn, difficulty='medium') {
    this.id        = 'bot_' + (BBID++);
    this.botBaseId = this.id;
    this.name      = NAMES[Math.floor(Math.random()*NAMES.length)] + ' [BOT]';
    this.isBot     = true;
    this.accountEmail = null;

    this.x = spawn.x; this.y = spawn.y;
    this.angle = 0;
    this.sparKey = sparKey;
    // Melee-only enforcement
    const room = C.SPAR_ROOMS && C.SPAR_ROOMS[sparKey];
    this.meleeOnly = !!(room && room.meleeOnly);

    this.alive = true;
    this.hp = 120; this.maxHP = 120;
    this.respawnTimer = 0;
    if (this.meleeOnly) {
      this.weapon = ['blade','katana','nunchaku','mace'][Math.floor(Math.random()*4)];
    } else {
      this.weapon = ['pistol','smg','shotgun','rifle','ripper','shredder'][Math.floor(Math.random()*6)];
    }
    this.ammo  = C.WEAPONS[this.weapon].magazine || 0;
    this.reloading = false; this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.dashCooldown = 0; this.dashing = false; this.dashTimer = 0;
    this.dashVx = 0; this.dashVy = 0; this.dashInv = false;

    this.zone = { type:'spar', key:sparKey };
    this.role = 'fighter';
    this.matchKey = sparKey;

    this.coins = 0;
    this.equipped = {};
    this.profile = { body:'#6a3a3a', accent:'#ff8060', head:'#e8c8a0', hair:'#3a1818' };
    this.squadId = null; this.squadName = null;
    this.inSeat = false; this.seatId = null; this.seatKind = null;
    this.spectatingSpar = null;
    this.vehicleId = null;
    this.streak = 0;
    this.bio = 'auto-fighter';

    this.dancing = false; this.chatBubble = null; this.chatTimer = 0;
    this.dashDir = null;
    this.input = { dx:0, dy:0, angle:0, shoot:false };

    const d = C.DIFFICULTY[difficulty] || C.DIFFICULTY.medium;
    this.diff = d;
    this.targetId = null;
    this._reactionT = 0;
    this._dodgeT = 0;
    this._wanderT = 0;
    this._wanderDx = 0; this._wanderDy = 0;
  }

  resetHealth(hp) { this.hp = hp; this.maxHP = hp; this.alive = true; }
  takeDamage(n) {
    if (!this.alive) return 0;
    const before = this.hp;
    this.hp = Math.max(0, this.hp - n);
    this.lastHitTime = Date.now();
    if (this.hp <= 0) this.alive = false;
    return before - this.hp;
  }

  rateCheck() { return true; }

  // Public snap (must match Player.toSnap shape)
  toSnap() {
    return {
      id:this.id, name:this.name, x:this.x, y:this.y, angle:this.angle,
      hp:this.hp, maxHP:this.maxHP, alive:this.alive,
      weapon:this.weapon, ammo:this.ammo, reloading:this.reloading,
      bodyColor:this.profile.body, accentColor:this.profile.accent,
      headColor:this.profile.head, hairColor:this.profile.hair,
      profile:this.profile, equipped:this.equipped, squadName:this.squadName,
      streak:this.streak, dashInv:this.dashInv,
      chatBubble:this.chatBubble, dancing:false,
      role:this.role, matchKey:this.matchKey,
      vehicleId:null, inSeat:false, seatId:null, seatKind:null, spectatingSpar:null,
      zone:'spar', sparKey:this.matchKey,
      coins:0, onJob:false, jobOrder:null,
      isBot:true, lastHitTime:0,
    };
  }

  // AI tick — returns array of bullets to add
  tick(dt, walls, opponent) {
    if (!this.alive) return [];
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = C.WEAPONS[this.weapon].magazine || 0;
      }
    }
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (!opponent || !opponent.alive) {
      // Idle — no movement
      this.input.dx = 0; this.input.dy = 0;
      return [];
    }

    const d = this.diff;
    const dx = opponent.x - this.x, dy = opponent.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const desiredAngle = Math.atan2(dy, dx);

    // Reaction delay before aiming/shooting
    this._reactionT -= dt;
    if (this._reactionT < 0) this._reactionT = 0;

    // Aim with error
    const err = (Math.random() - 0.5) * d.aimError * 2;
    const targetAngle = desiredAngle + err;
    // Smoothly turn
    let diff = targetAngle - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += diff * Math.min(1, 7 * dt);

    // Movement: keep mid-range, sometimes strafe (dodge)
    this._wanderT -= dt;
    if (this._wanderT <= 0) {
      this._wanderT = 0.4 + Math.random() * 0.8;
      // strafe perpendicular
      const sgn = Math.random() < 0.5 ? -1 : 1;
      this._wanderDx = -Math.sin(desiredAngle) * sgn;
      this._wanderDy =  Math.cos(desiredAngle) * sgn;
    }
    // Range preference
    let towardSign = 0;
    const ideal = (this.weapon === 'shotgun') ? 90 : (this.weapon === 'rifle' ? 230 : 160);
    if (dist > ideal + 30) towardSign = 1;
    else if (dist < ideal - 40) towardSign = -1;

    const towardX = Math.cos(desiredAngle) * towardSign;
    const towardY = Math.sin(desiredAngle) * towardSign;
    const mvx = towardX * 0.7 + this._wanderDx * 0.6;
    const mvy = towardY * 0.7 + this._wanderDy * 0.6;
    const ml = Math.hypot(mvx, mvy) || 1;
    const speedMult = d.speed * (this.reloading ? (C.WEAPONS[this.weapon]?.reloadSlow ?? 1) : 1);

    this.x += (mvx / ml) * C.PLAYER.speed * speedMult * dt;
    this.y += (mvy / ml) * C.PLAYER.speed * speedMult * dt;

    resolveWalls(this, C.PLAYER.radius, walls);

    // Reload if out
    const wdef = C.WEAPONS[this.weapon];
    if (!this.reloading && wdef.magazine > 0 && this.ammo === 0) {
      this.reloading = true;
      this.reloadTimer = wdef.reloadTime;
    }

    // Fire if can
    const bullets = [];
    if (!this.reloading && this.fireCooldown <= 0 && Math.abs(diff) < 0.35 && Math.random() < d.aggression) {
      if (wdef.type === 'melee') {
        if (dist < wdef.range + 10) {
          this.fireCooldown = 1 / wdef.fireRate;
          bullets.push({melee:true, id:++BOT_BID, ownerId:this.id, x:this.x, y:this.y, angle:this.angle, range:wdef.range, damage:wdef.damage, weapon:this.weapon});
        }
      } else if (this.ammo > 0) {
        this.ammo--;
        this.fireCooldown = 1 / wdef.fireRate;
        const n = wdef.pellets || 1;
        for (let i = 0; i < n; i++) {
          const sp = (Math.random()*2 - 1) * wdef.spread;
          const ang = this.angle + sp;
          bullets.push({
            id:++BOT_BID, ownerId:this.id, x:this.x, y:this.y,
            vx:Math.cos(ang)*wdef.bulletSpeed, vy:Math.sin(ang)*wdef.bulletSpeed,
            damage:wdef.damage, lifetime:C.BULLET_LIFETIME, weapon:this.weapon,
          });
        }
      }
    }

    return bullets;
  }
}

module.exports = Bot;
