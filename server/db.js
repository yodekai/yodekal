// server/db.js — simple file-backed JSON store for accounts + squads
'use strict';
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const SQUADS_FILE   = path.join(DATA_DIR, 'squads.json');

function _load(file, def) {
  try {
    if (!fs.existsSync(file)) return def;
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw || JSON.stringify(def));
  } catch (e) { console.error('db load error', file, e); return def; }
}

let accounts = _load(ACCOUNTS_FILE, {});
let squads   = _load(SQUADS_FILE, {});

let saveTimer = null;
function _scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts)); } catch(e){ console.error('save accounts err',e); }
    try { fs.writeFileSync(SQUADS_FILE, JSON.stringify(squads)); } catch(e){ console.error('save squads err',e); }
    saveTimer = null;
  }, 2000);
}

function _validEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length < 100;
}

function getOrCreateAccount(email, defaults) {
  if (!_validEmail(email)) return null;
  email = email.toLowerCase().trim();
  if (!accounts[email]) {
    accounts[email] = {
      email,
      name: defaults.name || 'Player',
      profile: {
        bodyColor:   defaults.bodyColor   || '#4a6090',
        accentColor: defaults.accentColor || '#5aafff',
        headColor:   defaults.headColor   || '#e8c8a0',
        hairColor:   defaults.hairColor   || '#3a2a1a',
        bio: defaults.bio || '',
      },
      equipped: { gunSkin: null, head: null, body: null, cloak: null },
      owned: [],
      coins: 500,
      wins: 0,
      losses: 0,
      pkKills: 0,
      pkDeaths: 0,
      vaultKills: 0,
      squadId: null,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      totalPlaySec: 0,
    };
    _scheduleSave();
  }
  return accounts[email];
}

function getAccount(email) {
  if (!_validEmail(email)) return null;
  return accounts[email.toLowerCase().trim()] || null;
}

function saveAccount(email) {
  if (accounts[email]) { accounts[email].lastSeen = Date.now(); _scheduleSave(); }
}

function adjustCoins(email, delta) {
  const a = accounts[email]; if (!a) return false;
  a.coins = Math.max(0, (a.coins || 0) + delta);
  _scheduleSave();
  return a.coins;
}

function updateProfile(email, patch) {
  const a = accounts[email]; if (!a) return false;
  if (patch.name) a.name = String(patch.name).slice(0,16).replace(/[<>]/g,'');
  if (patch.bio !== undefined) a.profile.bio = String(patch.bio).slice(0,120).replace(/[<>]/g,'');
  if (patch.bodyColor && /^#[0-9a-fA-F]{6}$/.test(patch.bodyColor)) a.profile.bodyColor = patch.bodyColor;
  if (patch.accentColor && /^#[0-9a-fA-F]{6}$/.test(patch.accentColor)) a.profile.accentColor = patch.accentColor;
  if (patch.headColor && /^#[0-9a-fA-F]{6}$/.test(patch.headColor)) a.profile.headColor = patch.headColor;
  if (patch.hairColor && /^#[0-9a-fA-F]{6}$/.test(patch.hairColor)) a.profile.hairColor = patch.hairColor;
  _scheduleSave();
  return true;
}

function purchaseItem(email, itemId, item) {
  const a = accounts[email]; if (!a) return {ok:false, msg:'no account'};
  if (a.owned.includes(itemId)) return {ok:false, msg:'already owned'};
  if (item.unlockOnly) return {ok:false, msg:'not for sale'};
  if (a.coins < item.price) return {ok:false, msg:'not enough coins'};
  a.coins -= item.price;
  a.owned.push(itemId);
  _scheduleSave();
  return {ok:true, coins:a.coins, owned:a.owned};
}

function equipItem(email, itemId, slot) {
  const a = accounts[email]; if (!a) return false;
  if (itemId && !a.owned.includes(itemId)) return false;
  if (!['gunSkin','head','body','cloak'].includes(slot)) return false;
  if (!a.equipped.cloak && a.equipped.cloak !== null) a.equipped.cloak = null;
  a.equipped[slot] = itemId || null;
  _scheduleSave();
  return true;
}

function unlockItem(email, itemId) {
  const a = accounts[email]; if (!a) return false;
  if (!a.owned.includes(itemId)) {a.owned.push(itemId); _scheduleSave();}
  return true;
}

function incrementStat(email, key, n) {
  const a = accounts[email]; if (!a) return;
  a[key] = (a[key] || 0) + n;
  _scheduleSave();
}

// ── Squads ───────────────────────────────────────────────────
function createSquad(ownerEmail, name) {
  const a = accounts[ownerEmail]; if (!a) return {ok:false, msg:'no account'};
  if (a.squadId) return {ok:false, msg:'already in a squad'};
  const safe = String(name||'').slice(0,16).replace(/[<>]/g,'').trim();
  if (!safe) return {ok:false, msg:'name required'};
  const id = 'sq_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6);
  squads[id] = {
    id, name: safe, owner: ownerEmail,
    members: [ownerEmail],
    vaultHoldSec: 0,
    vaultOwnedSince: null,
    hatUnlocked: false,
    createdAt: Date.now(),
  };
  a.squadId = id;
  _scheduleSave();
  return {ok:true, squad: squads[id]};
}

function joinSquad(email, squadId) {
  const a = accounts[email]; if (!a) return {ok:false, msg:'no account'};
  if (a.squadId) return {ok:false, msg:'already in a squad'};
  const s = squads[squadId]; if (!s) return {ok:false, msg:'squad not found'};
  if (s.members.length >= 10) return {ok:false, msg:'squad full'};
  s.members.push(email);
  a.squadId = squadId;
  _scheduleSave();
  return {ok:true, squad:s};
}

function leaveSquad(email) {
  const a = accounts[email]; if (!a || !a.squadId) return false;
  const s = squads[a.squadId];
  if (s) {
    s.members = s.members.filter(m => m !== email);
    if (s.members.length === 0) delete squads[a.squadId];
    else if (s.owner === email) s.owner = s.members[0];
  }
  a.squadId = null;
  _scheduleSave();
  return true;
}

function getSquad(squadId) { return squads[squadId] || null; }
function getAllSquads() { return Object.values(squads); }

function addVaultHoldTime(squadId, seconds) {
  const s = squads[squadId]; if (!s) return;
  s.vaultHoldSec += seconds;
  if (!s.hatUnlocked && s.vaultHoldSec >= 300 * 3600) {
    s.hatUnlocked = true;
    for (const memEmail of s.members) unlockItem(memEmail, 'hat_vault');
  }
  _scheduleSave();
}

function setVaultOwner(squadId) {
  // Stop tracking time for old owner, start for new owner
  for (const id in squads) {
    if (squads[id].vaultOwnedSince) {
      const sec = (Date.now() - squads[id].vaultOwnedSince) / 1000;
      addVaultHoldTime(id, sec);
      squads[id].vaultOwnedSince = null;
    }
  }
  if (squadId && squads[squadId]) squads[squadId].vaultOwnedSince = Date.now();
  _scheduleSave();
}

function getCurrentVaultOwner() {
  for (const id in squads) if (squads[id].vaultOwnedSince) return squads[id];
  return null;
}

function flushVaultHoldTime() {
  // Periodically dump ongoing hold time so it survives a crash
  for (const id in squads) {
    if (squads[id].vaultOwnedSince) {
      const sec = (Date.now() - squads[id].vaultOwnedSince) / 1000;
      if (sec >= 30) {
        addVaultHoldTime(id, sec);
        squads[id].vaultOwnedSince = Date.now();
      }
    }
  }
}

module.exports = {
  getOrCreateAccount, getAccount, saveAccount,
  adjustCoins, updateProfile,
  purchaseItem, equipItem, unlockItem, incrementStat,
  createSquad, joinSquad, leaveSquad, getSquad, getAllSquads,
  setVaultOwner, getCurrentVaultOwner, addVaultHoldTime, flushVaultHoldTime,
};
