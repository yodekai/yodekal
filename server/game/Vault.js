// server/game/Vault.js — the central vault in VAULT_ZONE
'use strict';
const C  = require('../../shared/constants');
const db = require('../db');
const { bulletHitsWall } = require('./Collision');

class Vault {
  constructor(io) {
    this.io = io;
    this.x = C.VAULT_ZONE.vault.x + C.VAULT_ZONE.vault.w/2;
    this.y = C.VAULT_ZONE.vault.y + C.VAULT_ZONE.vault.h/2;
    this.w = C.VAULT_ZONE.vault.w;
    this.h = C.VAULT_ZONE.vault.h;
    this.maxHP = C.VAULT_ZONE.vaultMaxHP;
    this.hp = this.maxHP;
    this.lastDamageT = 0;
    this.lastDamagerSquadId = null;
    // Restore current owner from db
    const owner = db.getCurrentVaultOwner();
    this.ownerSquadId = owner ? owner.id : null;
  }

  // Returns true if bullet hit the vault
  testBulletHit(b) {
    const v = C.VAULT_ZONE.vault;
    const px = b.x, py = b.y;
    // simple AABB check
    return px >= v.x && px <= v.x + v.w && py >= v.y && py <= v.y + v.h;
  }

  applyDamage(damage, attacker) {
    if (this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - damage);
    this.lastDamageT = Date.now();
    this.lastDamagerSquadId = attacker.squadId || null;
    this.io.emit('vaultDamage', {hp:this.hp, maxHP:this.maxHP, attackerId:attacker.id, damage});
    // Reward attacker coins for damage
    if (attacker.accountEmail) {
      const reward = Math.round(damage * C.ECONOMY.VAULT_DAMAGE_REWARD_PER_HP);
      if (reward > 0) {
        const c = db.adjustCoins(attacker.accountEmail, reward);
        if (c !== false) attacker.coins = c;
      }
    }
    if (this.hp <= 0) this._onBreach(attacker);
  }

  _onBreach(killer) {
    const oldOwner = this.ownerSquadId;
    // The squad of the killing-blow player claims (if they have a squad)
    let newOwner = null;
    if (killer.squadId) newOwner = killer.squadId;
    else newOwner = this.lastDamagerSquadId; // fall back to last attacker's squad

    if (newOwner !== oldOwner) {
      db.setVaultOwner(newOwner);
      this.ownerSquadId = newOwner;
    }
    this.hp = this.maxHP;
    this.io.emit('vaultBreach', {
      newOwnerId: newOwner,
      newOwnerName: newOwner ? db.getSquad(newOwner)?.name : null,
      killerId: killer.id,
      killerName: killer.name,
    });
  }

  tick(dt) {
    // Regen if not damaged recently
    if (this.hp < this.maxHP && (Date.now() - this.lastDamageT) / 1000 > C.VAULT_ZONE.vaultRegenDelay) {
      this.hp = Math.min(this.maxHP, this.hp + C.VAULT_ZONE.vaultRegenRate * dt);
    }
  }

  snap() {
    return {hp:this.hp, maxHP:this.maxHP, ownerSquadId:this.ownerSquadId};
  }
}

module.exports = Vault;
