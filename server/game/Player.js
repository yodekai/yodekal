// server/game/Player.js — v6 with accounts, coins, squads, skins
'use strict';
const C = require('../../shared/constants');
const { resolveWalls } = require('./Collision');
const { zoneOf }       = require('./Worldgen');

let BID = 0;

class Player {
  constructor(socketId, profile) {
    this.id = socketId;
    this.accountEmail = profile.accountEmail || null;  // null = guest
    this.name = profile.name;
    this.bodyColor   = profile.bodyColor   || C.BODY_COLORS[0];
    this.accentColor = profile.accentColor || C.ACCENT_COLORS[0];
    this.headColor   = profile.headColor   || C.HEAD_COLORS[0];
    this.hairColor   = profile.hairColor   || C.HAIR_COLORS[0];
    this.bio = profile.bio || '';
    this.equipped = profile.equipped || {gunSkin:null, head:null, body:null, cloak:null};
    this.owned = profile.owned || [];
    this.coins = profile.coins || 0;
    this.wins = profile.wins || 0;
    this.losses = profile.losses || 0;
    this.pkKills = profile.pkKills || 0;
    this.squadId = profile.squadId || null;
    this.squadName = profile.squadName || null;

    const sa = C.LOBBY.SPAWN_AREA;
    this.x = sa.x + Math.random() * sa.w;
    this.y = sa.y + Math.random() * sa.h;
    this.angle = 0;
    this.hp = C.PLAYER.maxHP; this.maxHP = C.PLAYER.maxHP;
    this.alive = true;
    this.weapon = 'pistol'; this.ammo = C.WEAPONS.pistol.magazine;
    this.reloading = false; this.reloadTimer = 0;
    this.fireCooldown = 0; this.dashCooldown = 0;
    this.dashTimer = 0; this.dashVx = 0; this.dashVy = 0;
    this.dashing = false; this.dashInv = false;
    this.jetpackOn = false;
    this.jetpackFuel = 1.0;
    this.streak = 0;
    this.inSeat = false; this.seatId = null; this.seatKind = null; // 'lobby' | 'spec' | 'lounge'
    this.spectatingSpar = null;
    this.emote = null; this.emoteTimer = 0;
    this.chatBubble = null; this.chatTimer = 0;
    this.dancing = false; this.danceTimer = 0;
    this.joinedAt = Date.now();
    this.respawnTimer = 0;
    this.lastHitTime = 0;
    this.vehicleId = null;
    this.zone = {type:'lobby'};
    this.matchKey = null;
    this.role = 'free';

    // Job state
    this.onJob = false;
    this.jobOrder = null; // {target:{amber,blue,green,red}, progress:{...}, timeLeft, score}
    this.jobCooldown = 0;

    // Anti-cheat counters
    this._inputCount = 0;
    this._chatCount = 0;
    this._dmCount = 0;
    this._actionCount = 0;
    this._lastResetT = Date.now();

    this.input = {dx:0, dy:0, angle:0, shoot:false, reload:false, dash:false, weapon:null};
  }

  rateCheck(kind) {
    const now = Date.now();
    if (now - this._lastResetT >= 1000) {
      this._inputCount = 0; this._chatCount = 0; this._dmCount = 0; this._actionCount = 0;
      this._lastResetT = now;
    }
    const A = C.ANTICHEAT;
    if (kind === 'input')  return ++this._inputCount  <= A.MAX_INPUTS_PER_SEC;
    if (kind === 'chat')   return ++this._chatCount   <= A.MAX_CHAT_PER_SEC;
    if (kind === 'dm')     return ++this._dmCount     <= A.MAX_DM_PER_SEC;
    if (kind === 'action') return ++this._actionCount <= A.MAX_ACTION_PER_SEC;
    return true;
  }

  setWeapon(w) {
    if (!C.WEAPONS[w] || w === this.weapon) return;
    this.weapon = w;
    this.ammo = C.WEAPONS[w].magazine || 0;
    this.reloading = false;
    this.reloadTimer = 0;
  }

  resetHealth(maxHP) {
    this.maxHP = maxHP;
    this.hp = maxHP;
    this.alive = true;
    this.weapon = 'pistol';
    this.ammo = C.WEAPONS.pistol.magazine;
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.dashCooldown = 0;
    this.dashing = false;
  }

  takeDamage(n) {
    if (!this.alive || this.dashInv) return 0;
    const a = Math.min(n, this.hp);
    this.hp -= a;
    this.lastHitTime = Date.now();
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return a;
  }

  tick(dt, walls) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.emoteTimer > 0) { this.emoteTimer -= dt; if (this.emoteTimer <= 0) this.emote = null; }
    if (this.chatTimer > 0) { this.chatTimer -= dt; if (this.chatTimer <= 0) this.chatBubble = null; }
    if (this.danceTimer > 0) { this.danceTimer -= dt; if (this.danceTimer <= 0) this.dancing = false; }
    if (this.jobCooldown > 0) this.jobCooldown -= dt;
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.reloading = false; this.ammo = C.WEAPONS[this.weapon].magazine || 0; }
    }

    // Death respawn handling per zone
    if (!this.alive) {
      if (this.zone.type === 'pk' || this.zone.type === 'vault') {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          const spawns = this.zone.type === 'pk' ? C.PK.spawns : C.VAULT_ZONE.spawns;
          const sp = spawns[Math.floor(Math.random() * spawns.length)];
          this.x = sp.x; this.y = sp.y;
          this.hp = this.maxHP = C.PLAYER.maxHP;
          this.alive = true;
          this.weapon = 'pistol';
          this.ammo = C.WEAPONS.pistol.magazine;
        }
      }
      return [];
    }

    const inp = this.input;

    // Weapon switch — allowed anywhere
    if (inp.weapon && C.WEAPONS[inp.weapon] && inp.weapon !== this.weapon) {
      this.setWeapon(inp.weapon);
    }

    // Jetpack toggle (only outside spar fights — keep arena combat clean)
    const jpAllowed = !(this.zone.type === 'spar' && this.role === 'fighter');
    if (inp.jetpackToggle && jpAllowed) {
      if (!this.jetpackOn && this.jetpackFuel >= C.JETPACK.minActivate) {
        this.jetpackOn = true;
      } else if (this.jetpackOn) {
        this.jetpackOn = false;
      }
    }
    if (!jpAllowed) this.jetpackOn = false;
    // Fuel drain/recharge
    if (this.jetpackOn) {
      this.jetpackFuel -= C.JETPACK.drainPerSec * dt;
      if (this.jetpackFuel <= 0) { this.jetpackFuel = 0; this.jetpackOn = false; }
    } else {
      this.jetpackFuel = Math.min(C.JETPACK.fuelMax, this.jetpackFuel + C.JETPACK.rechargePerSec * dt);
    }

    if (inp.dash && this.dashCooldown <= 0 && !this.dashing && !this.inSeat) {
      let dvx = inp.dx || Math.cos(this.angle);
      let dvy = inp.dy || Math.sin(this.angle);
      const dl = Math.hypot(dvx,dvy) || 1;
      dvx /= dl; dvy /= dl;
      this.dashVx = dvx; this.dashVy = dvy;
      this.dashing = true; this.dashTimer = C.PLAYER.dashDuration;
      this.dashCooldown = C.PLAYER.dashCooldown;
      this.dashInv = true;
      setTimeout(() => { this.dashInv = false; }, C.PLAYER.dashInv * 1000);
    }

    let speedMult = 1;
    if (this.reloading) {
      const w = C.WEAPONS[this.weapon];
      speedMult = w?.reloadSlow ?? 1;
    }
    if (this.jetpackOn) speedMult *= C.JETPACK.speedMul;

    if (this.dashing) {
      this.dashTimer -= dt;
      this.x += this.dashVx * C.PLAYER.dashSpeed * dt;
      this.y += this.dashVy * C.PLAYER.dashSpeed * dt;
      if (this.dashTimer <= 0) this.dashing = false;
    } else if (!this.inSeat && !this.dancing) {
      let mvx = inp.dx, mvy = inp.dy;
      const ml = Math.hypot(mvx, mvy);
      if (ml > 1) { mvx /= ml; mvy /= ml; }
      this.x += mvx * C.PLAYER.speed * speedMult * dt;
      this.y += mvy * C.PLAYER.speed * speedMult * dt;
    }
    this.angle = inp.angle;

    resolveWalls(this, C.PLAYER.radius, walls);

    this.x = Math.max(C.PERIMETER.x + 14, Math.min(C.PERIMETER.x + C.PERIMETER.w - 14, this.x));
    this.y = Math.max(C.PERIMETER.y + 14, Math.min(C.PERIMETER.y + C.PERIMETER.h - 14, this.y));

    this.zone = zoneOf(this.x, this.y);

    // Melee-only spar rooms — force blade weapon
    if (this.zone.type === 'spar' && this.role === 'fighter' && this.zone.room?.meleeOnly && this.weapon !== 'blade' && this.weapon !== 'katana') {
      this.setWeapon('blade');
    }

    if (inp.reload && !this.reloading) {
      const w = C.WEAPONS[this.weapon];
      if (w && w.magazine > 0 && this.ammo < w.magazine) {
        this.reloading = true;
        this.reloadTimer = w.reloadTime;
      }
    }

    // Combat allowed in: spar (as fighter), pk, vault
    const canFight = (this.zone.type === 'spar' && this.role === 'fighter')
                     || this.zone.type === 'pk'
                     || this.zone.type === 'vault';
    if (!canFight) return [];

    const bullets = [];
    const wdef = C.WEAPONS[this.weapon];
    if (inp.shoot && !this.reloading && this.fireCooldown <= 0) {
      if (wdef.type === 'melee') {
        this.fireCooldown = 1 / wdef.fireRate;
        bullets.push({melee:true, id:++BID, ownerId:this.id, x:this.x, y:this.y, angle:this.angle, range:wdef.range, damage:wdef.damage, weapon:this.weapon});
      } else if (this.ammo > 0) {
        this.ammo--;
        this.fireCooldown = 1 / wdef.fireRate;
        for (let p = 0; p < wdef.pellets; p++) {
          const spr = (Math.random() - 0.5) * wdef.spread * 2;
          const a = this.angle + spr;
          bullets.push({
            id:++BID, ownerId:this.id,
            x:this.x + Math.cos(this.angle) * (C.PLAYER.radius + 4),
            y:this.y + Math.sin(this.angle) * (C.PLAYER.radius + 4),
            vx:Math.cos(a) * wdef.bulletSpeed,
            vy:Math.sin(a) * wdef.bulletSpeed,
            damage:wdef.damage,
            lifetime:C.BULLET_LIFETIME,
            weapon:this.weapon,
          });
        }
        if (this.ammo === 0) { this.reloading = true; this.reloadTimer = wdef.reloadTime; }
      }
    }
    return bullets;
  }

  toSnap() {
    return {
      id:this.id, name:this.name, x:this.x, y:this.y, angle:this.angle,
      hp:this.hp, maxHP:this.maxHP, alive:this.alive,
      weapon:this.weapon, ammo:this.ammo, reloading:this.reloading, reloadTimer:this.reloadTimer,
      dashing:this.dashing, streak:this.streak,
      jetpackOn:this.jetpackOn, jetpackFuel:this.jetpackFuel,
      bodyColor:this.bodyColor, accentColor:this.accentColor,
      headColor:this.headColor, hairColor:this.hairColor,
      equipped:this.equipped, bio:this.bio,
      inSeat:this.inSeat, seatId:this.seatId, seatKind:this.seatKind, spectatingSpar:this.spectatingSpar,
      emote:this.emote, chatBubble:this.chatBubble, dancing:this.dancing,
      wins:this.wins, losses:this.losses, pkKills:this.pkKills,
      coins:this.coins, squadId:this.squadId, squadName:this.squadName,
      zone:this.zone.type, sparKey:this.zone.key || null,
      role:this.role, matchKey:this.matchKey,
      lastHitTime:this.lastHitTime,
      vehicleId:this.vehicleId,
      onJob:this.onJob, jobOrder:this.jobOrder, jobCooldown:Math.ceil(this.jobCooldown),
      onlineTime:Math.floor((Date.now() - this.joinedAt) / 1000),
      isGuest:!this.accountEmail,
    };
  }
}

module.exports = Player;
