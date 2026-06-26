// server/game/Job.js — bartender mini-job
'use strict';
const C  = require('../../shared/constants');
const db = require('../db');

const BOTTLE_COLORS = ['amber','blue','green','red'];

function _randomOrder() {
  const counts = {amber:0, blue:0, green:0, red:0};
  const total = 2 + Math.floor(Math.random() * 4); // 2-5 drinks
  for (let i = 0; i < total; i++) {
    const c = BOTTLE_COLORS[Math.floor(Math.random() * BOTTLE_COLORS.length)];
    counts[c]++;
  }
  return counts;
}

function startShift(player) {
  if (player.onJob) return {ok:false, msg:'already working'};
  if (player.jobCooldown > 0) return {ok:false, msg:`cooldown ${Math.ceil(player.jobCooldown)}s`};
  player.onJob = true;
  player.jobOrder = {
    target: _randomOrder(),
    progress: {amber:0, blue:0, green:0, red:0},
    timeLeft: C.ECONOMY.JOB_SHIFT_DURATION,
    coinsEarned: 0,
    drinksMade: 0,
  };
  return {ok:true};
}

function pourBottle(player, color) {
  if (!player.onJob || !player.jobOrder) return {ok:false};
  if (!BOTTLE_COLORS.includes(color)) return {ok:false};
  const o = player.jobOrder;
  if ((o.progress[color]||0) < (o.target[color]||0)) {
    o.progress[color]++;
    // Check if order complete
    let done = true;
    for (const c of BOTTLE_COLORS) if (o.progress[c] !== o.target[c]) { done = false; break; }
    if (done) {
      const reward = C.ECONOMY.JOB_DRINK_REWARD;
      o.coinsEarned += reward;
      o.drinksMade++;
      if (player.accountEmail) {
        const c = db.adjustCoins(player.accountEmail, reward);
        if (c !== false) player.coins = c;
      }
      // Next order
      o.target = _randomOrder();
      o.progress = {amber:0, blue:0, green:0, red:0};
      return {ok:true, complete:true, reward};
    }
    return {ok:true};
  } else {
    // Wrong pour — penalty
    if (player.accountEmail) {
      const c = db.adjustCoins(player.accountEmail, -C.ECONOMY.JOB_FAIL_PENALTY);
      if (c !== false) player.coins = c;
    }
    return {ok:false, wrong:true};
  }
}

function endShift(player) {
  if (!player.onJob) return;
  const o = player.jobOrder;
  player.onJob = false;
  player.jobOrder = null;
  player.jobCooldown = C.ECONOMY.JOB_COOLDOWN;
  return o;
}

function tick(player, dt) {
  if (!player.onJob || !player.jobOrder) return null;
  player.jobOrder.timeLeft -= dt;
  if (player.jobOrder.timeLeft <= 0) {
    const result = endShift(player);
    return {ended:true, result};
  }
  return null;
}

module.exports = { startShift, pourBottle, endShift, tick };
