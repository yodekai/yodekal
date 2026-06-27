// server/game/GameRoom.js — v6
'use strict';
const C      = require('../../shared/constants');
const db     = require('../db');
const Player = require('./Player');
const Bot    = require('./Bot');
const Vault  = require('./Vault');
const Job    = require('./Job');
const { buildWalls, zoneOf, isSafe } = require('./Worldgen');
const { bulletHitsWall }     = require('./Collision');

class GameRoom {
  constructor(io) {
    this.io = io;
    this.players = new Map();
    this.bullets = [];
    this.walls = buildWalls();
    this.chatLog = [];

    this.matches = {};
    for (const key in C.SPAR_ROOMS) {
      this.matches[key] = {
        key, state:'idle', fighters:[], queue:[],
        cdVal:C.COUNTDOWN, cdTimer:1.0,
        matchTimer:0, resultTimer:0,
        lastWinner:null,
        championName:'', championStreak:0,
      };
    }

    this.vehicles = C.VEHICLE.spawn.map((p,i) => ({id:'veh_'+i, x:p.x, y:p.y, riderId:null, vx:0, vy:0, angle:0}));

    this.bots = new Map(); // botId -> Bot instance, lives inside a match

    this.lobbySeats = [
      ...C.LOBBY.BAR_STOOLS.map((s,i) => ({id:'stool_'+i,    x:s.x,y:s.y, occupant:null, type:'stool',  kind:'lobby'})),
      ...C.LOBBY.BOOTHS.map((s,i)     => ({id:'booth_'+i,    x:s.x,y:s.y, occupant:null, type:'booth',  kind:'lobby'})),
    ];
    this.specSeats = [];
    for (const k in C.SPAR_ROOMS) {
      const r = C.SPAR_ROOMS[k];
      r.specSeats.forEach((s,i) => {
        this.specSeats.push({id:'spec_'+k+'_'+i, x:s.x, y:s.y, occupant:null, sparKey:k, type:'spec', kind:'spec'});
      });
    }
    this.loungeSeats = C.UPPER_LOUNGE.LOUNGE_SEATS.map((s,i) => ({id:'lounge_'+i, x:s.x, y:s.y, occupant:null, type:'lounge', kind:'lounge'}));

    this.vault = new Vault(io);
    this.chess = this._initChess();
    this.chessMoveTurn = 'w';
    this.raceMatch = { state:'idle', queue:[], racers:[], startTime:0, finishOrder:[] };

    // Vault coin reward tick
    this.vaultCoinAccum = 0;

    // ── Spawn ambient PK bots (wandering NPCs in PK zone) ──
    this._spawnPkBots(2);

    this.lastTick = Date.now();
    this.interval = setInterval(() => this._tick(), 1000 / C.TICK_RATE);
    this.flushInterval = setInterval(() => db.flushVaultHoldTime(), 60000);
  }

  destroy() { clearInterval(this.interval); clearInterval(this.flushInterval); }

  addPlayer(sid, profile) {
    if (this.players.size >= C.MAX_PLAYERS) return false;
    const p = new Player(sid, profile);
    this.players.set(sid, p);
    if (p.squadId) {
      const sq = db.getSquad(p.squadId);
      if (sq) p.squadName = sq.name;
    }
    this._broadcastRoom();
    return true;
  }

  removePlayer(sid) {
    const p = this.players.get(sid); if (!p) return;
    if (p.accountEmail) {
      // Persist final state
      const acc = db.getAccount(p.accountEmail);
      if (acc) {
        acc.coins = p.coins;
        acc.wins = p.wins;
        acc.losses = p.losses;
        acc.pkKills = p.pkKills;
        db.saveAccount(p.accountEmail);
      }
    }
    this._freeAnySeat(p);
    if (p.vehicleId) { const v = this.vehicles.find(v => v.id === p.vehicleId); if (v) v.riderId = null; }
    // Remove from race queue / racers
    this.raceMatch.queue = this.raceMatch.queue.filter(id => id !== sid);
    if (this.raceMatch.racers.includes(sid)) {
      this.raceMatch.racers = this.raceMatch.racers.filter(id => id !== sid);
      if (this.raceMatch.racers.length === 0) {
        this.raceMatch.state = 'idle'; this.raceMatch.finishOrder = [];
      }
      this._broadcastRaceState();
    }
    if (p.matchKey) {
      const m = this.matches[p.matchKey];
      if (m) {
        m.fighters = m.fighters.filter(id => id !== sid);
        m.queue = m.queue.filter(id => id !== sid);
        if (m.state === 'fighting' || m.state === 'countdown') this._endMatchByDisconnect(m, sid);
      }
    }
    this.players.delete(sid);
    this._broadcastRoom();
  }

  receiveInput(sid, inp) {
    const p = this.players.get(sid); if (!p) return;
    if (!p.rateCheck('input')) return;
    p.input = {
      dx: Math.max(-1, Math.min(1, Number(inp.dx) || 0)),
      dy: Math.max(-1, Math.min(1, Number(inp.dy) || 0)),
      angle: Number(inp.angle) || 0,
      shoot: !!inp.shoot, reload: !!inp.reload, dash: !!inp.dash,
      weapon: inp.weapon || null,
    };
  }

  receiveChat(sid, text) {
    const p = this.players.get(sid); if (!p) return;
    if (!p.rateCheck('chat')) return;
    if (p.zone.type === 'spar' && p.role === 'fighter') return;
    if (p.zone.type === 'pk' || p.zone.type === 'vault') return;
    const safe = String(text).slice(0,60).replace(/[<>]/g,'').trim();
    if (!safe) return;
    if (safe.toLowerCase() === '2step') {
      p.dancing = true; p.danceTimer = 4;
      p.chatBubble = '*2-steps*'; p.chatTimer = 4;
    } else {
      p.chatBubble = safe; p.chatTimer = 4.5;
    }
    const msg = {name:p.name, text:safe, accentColor:p.accentColor, ts:Date.now()};
    this.chatLog.push(msg);
    if (this.chatLog.length > 60) this.chatLog.shift();
    this.io.emit('chatMsg', msg);
  }

  receiveEmote(sid, key) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    const e = C.EMOTES.find(x => x.key === key);
    if (!e) return;
    if (e.dance) { p.dancing = true; p.danceTimer = 4; }
    p.emote = e; p.emoteTimer = 3;
    p.chatBubble = e.text; p.chatTimer = 3;
  }

  receiveDM(sid, targetId, text) {
    const from = this.players.get(sid), to = this.players.get(targetId);
    if (!from || !to) return;
    if (!from.rateCheck('dm')) return;
    const safe = String(text).slice(0,200).replace(/[<>]/g,'').trim();
    if (!safe) return;
    const msg = {fromId:sid, fromName:from.name, toId:targetId, toName:to.name, text:safe, ts:Date.now()};
    this.io.to(sid).emit('dm', msg);
    this.io.to(targetId).emit('dm', msg);
  }

  updateBio(sid, bio) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    p.bio = String(bio).slice(0,120).replace(/[<>]/g,'');
    if (p.accountEmail) db.updateProfile(p.accountEmail, {bio:p.bio});
  }

  updateAppearance(sid, d) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    const updates = {};
    if (d.bodyColor && C.BODY_COLORS.includes(d.bodyColor)) { p.bodyColor = d.bodyColor; updates.bodyColor = d.bodyColor; }
    if (d.accentColor && C.ACCENT_COLORS.includes(d.accentColor)) { p.accentColor = d.accentColor; updates.accentColor = d.accentColor; }
    if (d.headColor && C.HEAD_COLORS.includes(d.headColor)) { p.headColor = d.headColor; updates.headColor = d.headColor; }
    if (d.hairColor && C.HAIR_COLORS.includes(d.hairColor)) { p.hairColor = d.hairColor; updates.hairColor = d.hairColor; }
    if (p.accountEmail && Object.keys(updates).length) db.updateProfile(p.accountEmail, updates);
  }

  // ── Chess ────────────────────────────────────────────────────
  _initChess() {
    // Standard starting position. board[row][col], row 0 = black back rank.
    const back = ['R','N','B','Q','K','B','N','R'];
    const board = [];
    board.push(back.map(p => 'b' + p));            // row 0 — black back rank
    board.push(Array(8).fill('bP'));               // row 1 — black pawns
    for (let r = 2; r < 6; r++) board.push(Array(8).fill(null));
    board.push(Array(8).fill('wP'));               // row 6 — white pawns
    board.push(back.map(p => 'w' + p));            // row 7 — white back rank
    return board;
  }
  chessReset(sid) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    this.chess = this._initChess(); this.chessMoveTurn = 'w';
    this.io.emit('chessState', {board:this.chess, turn:this.chessMoveTurn});
  }
  chessMove(sid, {fromR, fromC, toR, toC}) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    // Bounds check
    if (![fromR, fromC, toR, toC].every(v => Number.isInteger(v) && v >= 0 && v < 8)) return;
    const piece = this.chess[fromR][fromC]; if (!piece) return;
    const color = piece[0]; // 'w' or 'b'
    if (color !== this.chessMoveTurn) return; // must be your color's turn
    // No friendly capture
    const target = this.chess[toR][toC];
    if (target && target[0] === color) return;
    // Simple sanity move check — pieces can move freely (legal-move enforcement is light to keep it fun & flexible)
    // Move
    this.chess[toR][toC] = piece;
    this.chess[fromR][fromC] = null;
    this.chessMoveTurn = color === 'w' ? 'b' : 'w';
    this.io.emit('chessState', {board:this.chess, turn:this.chessMoveTurn, last:{fromR,fromC,toR,toC}});
  }

  _tickWarps() {
    if (!C.PK.vaultWarp || !C.VAULT_ZONE.spawns) return;
    const w = C.PK.vaultWarp;
    for (const [, p] of this.players) {
      if (!p.alive || p.vehicleId || p.matchKey || p.inSeat) continue;
      if (p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h) {
        // Teleport to vault zone (north entry side)
        const spawns = C.VAULT_ZONE.spawns;
        const sp = spawns[Math.floor(Math.random() * spawns.length)];
        p.x = sp.x; p.y = sp.y;
        p.velX = 0; p.velY = 0;
        this.io.to(p.id).emit('warpFlash');
      }
    }
  }

  // ── Water Race ────────────────────────────────────────────────
  joinRaceQueue(sid) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    if (!C.WATER_RACE) return;
    if (this.raceMatch.queue.includes(sid) || this.raceMatch.racers.includes(sid)) return;
    if (p.matchKey || p.vehicleId || p.inSeat) return;
    this.raceMatch.queue.push(sid);
    this._broadcastRaceState();
    this._tryStartRace();
  }
  leaveRaceQueue(sid) {
    this.raceMatch.queue = this.raceMatch.queue.filter(id => id !== sid);
    this._broadcastRaceState();
  }
  _tryStartRace() {
    const R = C.WATER_RACE;
    if (this.raceMatch.state !== 'idle') return;
    const avail = this.raceMatch.queue.filter(sid => { const p = this.players.get(sid); return p; });
    if (avail.length < R.minPlayers) return;
    const take = Math.min(R.maxPlayers, avail.length);
    this.raceMatch.racers = avail.slice(0, take);
    this.raceMatch.queue = this.raceMatch.queue.filter(sid => !this.raceMatch.racers.includes(sid));
    this.raceMatch.racers.forEach((sid, idx) => {
      const p = this.players.get(sid); if (!p) return;
      const lane = R.lanes[idx % R.lanes.length];
      p.x = lane.x; p.y = lane.y;
      p.raceMode = true;
    });
    this.raceMatch.state = 'racing';
    this.raceMatch.startTime = Date.now();
    this.raceMatch.finishOrder = [];
    this._broadcastRaceState();
  }
  _tickRace(dt) {
    if (this.raceMatch.state !== 'racing') return;
    const R = C.WATER_RACE;
    const elapsed = (Date.now() - this.raceMatch.startTime) / 1000;
    // Check finishes
    for (const sid of this.raceMatch.racers) {
      if (this.raceMatch.finishOrder.includes(sid)) continue;
      const p = this.players.get(sid);
      if (!p) { this.raceMatch.finishOrder.push(sid); continue; }
      if (p.x >= R.finishX) this.raceMatch.finishOrder.push(sid);
    }
    // End conditions: all finished OR timeout
    if (this.raceMatch.finishOrder.length >= this.raceMatch.racers.length || elapsed >= R.duration) {
      this._endRace();
    }
  }
  _endRace() {
    const R = C.WATER_RACE;
    // Award winner (first in finishOrder)
    const winnerId = this.raceMatch.finishOrder[0];
    if (winnerId) {
      const wp = this.players.get(winnerId);
      if (wp && wp.accountEmail) {
        const c = db.adjustCoins(wp.accountEmail, R.prize);
        if (c !== false) wp.coins = c;
      }
      if (wp) this.io.emit('chat', {text:`${wp.name} won the water race! +${R.prize} ⌬`});
    }
    // Return all racers to lobby
    for (const sid of this.raceMatch.racers) {
      const p = this.players.get(sid); if (!p) continue;
      const qm = R.queueMarker;
      p.x = qm.x; p.y = qm.y + 28;
      p.raceMode = false;
    }
    this.raceMatch.state = 'idle';
    this.raceMatch.racers = [];
    this.raceMatch.finishOrder = [];
    this._broadcastRaceState();
    this._tryStartRace(); // start next if queue full
  }
  _broadcastRaceState() {
    this.io.emit('raceState', {
      state: this.raceMatch.state,
      queueIds: this.raceMatch.queue,
      racerIds: this.raceMatch.racers,
      finishOrder: this.raceMatch.finishOrder,
      timeLeft: this.raceMatch.state === 'racing' ? Math.max(0, C.WATER_RACE.duration - (Date.now() - this.raceMatch.startTime) / 1000) : 0,
    });
  }

  // ── Seats ────────────────────────────────────────────────────
  sitDown(sid, seatId) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    // Find seat in any pool
    let seat = this.lobbySeats.find(s => s.id === seatId)
            || this.specSeats.find(s => s.id === seatId)
            || this.loungeSeats.find(s => s.id === seatId);
    if (!seat || seat.occupant) return;
    // Validate zone
    if (seat.kind === 'lobby' && p.zone.type !== 'lobby') return;
    if (seat.kind === 'spec' && p.zone.type !== 'lobby') return; // spec seats are physically in lobby (south of spar rooms)
    if (seat.kind === 'lounge' && p.zone.type !== 'upper') return;
    this._freeAnySeat(p);
    seat.occupant = sid;
    p.inSeat = true; p.seatId = seatId; p.seatKind = seat.kind;
    p.spectatingSpar = (seat.kind === 'spec') ? seat.sparKey : null;
    p.x = seat.x; p.y = seat.y;
    this._broadcastRoom();
  }

  standUp(sid) { const p = this.players.get(sid); if (!p) return; this._freeAnySeat(p); this._broadcastRoom(); }

  _freeAnySeat(p) {
    if (!p.seatId) { p.inSeat = false; p.spectatingSpar = null; return; }
    for (const pool of [this.lobbySeats, this.specSeats, this.loungeSeats]) {
      const s = pool.find(x => x.id === p.seatId);
      if (s && s.occupant === p.id) { s.occupant = null; break; }
    }
    p.inSeat = false; p.seatId = null; p.seatKind = null; p.spectatingSpar = null;
  }

  // ── Vehicles ─────────────────────────────────────────────────
  mountVehicle(sid, vid) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    if (p.vehicleId) return;
    const v = this.vehicles.find(v => v.id === vid);
    if (!v || v.riderId) return;
    if (Math.hypot(p.x - v.x, p.y - v.y) > 50) return;
    v.riderId = sid; p.vehicleId = vid;
  }
  dismountVehicle(sid) {
    const p = this.players.get(sid); if (!p) return;
    if (!p.vehicleId) return;
    const v = this.vehicles.find(v => v.id === p.vehicleId);
    if (v) { v.riderId = null; v.vx = 0; v.vy = 0; }
    p.vehicleId = null;
  }

  // ── Spar queue ───────────────────────────────────────────────
  joinQueue(sid, sparKey) {
    const m = this.matches[sparKey]; if (!m) return;
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    if (m.queue.includes(sid) || m.fighters.includes(sid)) return;
    const room = C.SPAR_ROOMS[sparKey];
    if (room && room.autoBot && m.state === 'idle') {
      this.joinQueueBot(sid, sparKey, 'medium');
      return;
    }
    m.queue.push(sid);
    this._tryStartMatch(m);
    this._broadcastRoom();
  }
  leaveQueue(sid, sparKey) {
    if (sparKey) { const m = this.matches[sparKey]; if (m) m.queue = m.queue.filter(id => id !== sid); }
    else for (const k in this.matches) this.matches[k].queue = this.matches[k].queue.filter(id => id !== sid);
    this._broadcastRoom();
  }

  _spawnPkBots(n) {
    for (let i = 0; i < n; i++) {
      const sp = C.PK.spawns[i % C.PK.spawns.length];
      const bot = new Bot('pk', sp, 'easy');
      bot.matchKey = null;
      bot.mode = 'pk';
      bot.role = 'pk-bot';
      bot.maxHP = 80; bot.hp = 80;
      bot.weapon = ['pistol','smg'][i % 2];
      bot.ammo = C.WEAPONS[bot.weapon].magazine;
      this.bots.set(bot.id, bot);
    }
  }

  _respawnPkBot(bot) {
    const sp = C.PK.spawns[Math.floor(Math.random() * C.PK.spawns.length)];
    bot.x = sp.x; bot.y = sp.y;
    bot.hp = bot.maxHP; bot.alive = true;
    bot.ammo = C.WEAPONS[bot.weapon].magazine;
    bot.reloading = false;
  }

  joinQueueBot(sid, sparKey, difficulty='medium') {
    const m = this.matches[sparKey]; if (!m) return;
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    if (m.state !== 'idle') return;
    if (p.matchKey || p.role === 'fighter') return;
    // Only 1v1 spars support bots (classic/iron/blitz)
    if (sparKey === 'twos') return;
    const room = C.SPAR_ROOMS[sparKey];
    // Remove from any queues
    for (const k in this.matches) this.matches[k].queue = this.matches[k].queue.filter(id => id !== sid);
    // Set up player as fighter
    this._freeAnySeat(p);
    if (p.vehicleId) { const v = this.vehicles.find(v => v.id === p.vehicleId); if (v) v.riderId = null; p.vehicleId = null; }
    p.matchKey = sparKey;
    p.role = 'fighter';
    p.resetHealth(room.maxHP);
    p.x = room.spawn[0].x; p.y = room.spawn[0].y;
    // Spawn bot
    const bot = new Bot(sparKey, room.spawn[1], difficulty);
    bot.maxHP = room.maxHP; bot.hp = room.maxHP;
    this.bots.set(bot.id, bot);
    m.fighters = [sid, bot.id];
    m.state = 'fighting';
    m.matchTimer = C.MATCH_TIMER;
    this.io.emit('matchState', {sparKey:m.key, state:'fighting'});
    this._broadcastRoom();
  }

  unstickMe(sid) {
    const p = this.players.get(sid); if (!p) return;
    if (!p.rateCheck('action')) return;
    if (p.matchKey || p.role === 'fighter') return; // can't unstick out of match
    if (p.vehicleId) {
      const v = this.vehicles.find(v => v.id === p.vehicleId);
      if (v) v.riderId = null;
      p.vehicleId = null;
    }
    this._freeAnySeat(p);
    // Teleport to nearest safe spot of current zone
    let target = null;
    if (p.zone.type === 'spar') {
      // push to just outside south of that spar room
      const r = p.zone.room;
      target = {x: r.x + r.w/2, y: r.y + r.h + 40};
    } else if (p.zone.type === 'pk') {
      const sp = C.PK.spawns[0]; target = {x:sp.x, y:sp.y};
    } else if (p.zone.type === 'vault') {
      const sp = C.VAULT_ZONE.spawns[0]; target = {x:sp.x, y:sp.y};
    } else if (p.zone.type === 'upper') {
      target = {x:C.UPPER_LOUNGE.SPAWN.x, y:C.UPPER_LOUNGE.SPAWN.y};
    } else {
      // lobby default: center of spawn area
      const a = C.LOBBY.SPAWN_AREA;
      target = {x:a.x + a.w/2, y:a.y + a.h/2};
    }
    p.x = target.x; p.y = target.y;
    p.hp = p.maxHP; // restore HP for safety in case stuck in unsafe spot
  }


  giftCoins(sid, targetId, amount) {
    const sender = this.players.get(sid);
    const target = this.players.get(targetId);
    if (!sender || !target || sender === target) return;
    if (!sender.rateCheck('action')) return;
    if (!sender.accountEmail || !target.accountEmail) {
      this.io.to(sid).emit('tradeResult', {ok:false, msg:'both must be signed in'});
      return;
    }
    const amt = Math.max(1, Math.min(100000, Math.floor(amount)));
    if (sender.coins < amt) {
      this.io.to(sid).emit('tradeResult', {ok:false, msg:'not enough coins'});
      return;
    }
    // Both must be in trade room
    const tr = C.TRADE_ROOM;
    if (!tr) { this.io.to(sid).emit('tradeResult', {ok:false, msg:'trade unavailable'}); return; }
    const inTrade = (p) => p.x >= tr.x && p.x <= tr.x + tr.w && p.y >= tr.y && p.y <= tr.y + tr.h;
    if (!inTrade(sender) || !inTrade(target)) {
      this.io.to(sid).emit('tradeResult', {ok:false, msg:'both must be in the trade room'});
      return;
    }
    const sc = db.adjustCoins(sender.accountEmail, -amt);
    const tc = db.adjustCoins(target.accountEmail, +amt);
    if (sc === false || tc === false) {
      this.io.to(sid).emit('tradeResult', {ok:false, msg:'transfer failed'});
      return;
    }
    sender.coins = sc; target.coins = tc;
    this.io.to(sid).emit('tradeResult', {ok:true, msg:`sent ${amt} ⌬ to ${target.name}`});
    this.io.to(targetId).emit('tradeResult', {ok:true, msg:`received ${amt} ⌬ from ${sender.name}`});
  }

  _tryStartMatch(m) {
    if (m.state !== 'idle') return;
    const room = C.SPAR_ROOMS[m.key];
    const isShowdown = room.showdown;
    let need;
    if (isShowdown) need = room.minPlayers || 2;
    else if (m.key === 'twos') need = 4;
    else need = 2;
    const avail = m.queue.filter(sid => { const p = this.players.get(sid); return p && !p.matchKey; });
    if (avail.length >= need) {
      // Showdown: take everyone in queue up to maxPlayers
      const take = isShowdown ? Math.min(room.maxPlayers || 10, avail.length) : need;
      m.fighters = avail.slice(0, take);
      m.queue = m.queue.filter(sid => !m.fighters.includes(sid));
      m.fighters.forEach((sid, idx) => {
        const p = this.players.get(sid); if (!p) return;
        this._freeAnySeat(p);
        if (p.vehicleId) { const v = this.vehicles.find(v => v.id === p.vehicleId); if (v) v.riderId = null; p.vehicleId = null; }
        p.matchKey = m.key;
        p.role = 'fighter';
        p.resetHealth(room.maxHP);
        const sp = room.spawn[idx % room.spawn.length];
        p.x = sp.x; p.y = sp.y;
      });
      this._startFight(m);
    }
  }

  _startFight(m) {
    m.state = 'fighting';
    m.matchTimer = C.MATCH_TIMER;
    this.io.emit('matchState', {sparKey:m.key, state:'fighting'});
  }

  _endMatch(m, winnerSide, reason) {
    m.state = 'result';
    m.resultTimer = 4.0;
    let winnerName = '', winners = [], losers = [];
    const getName = (id) => this.players.get(id)?.name ?? this.bots.get(id)?.name ?? '?';
    if (Array.isArray(winnerSide)) {
      winners = winnerSide;
      losers = m.fighters.filter(id => !winnerSide.includes(id));
      winnerName = getName(winners[0]) + (winners[1] ? ' & ' + getName(winners[1]) : '');
    } else {
      winners = [winnerSide];
      losers = m.fighters.filter(id => id !== winnerSide);
      winnerName = getName(winnerSide);
    }
    const sparRoom = C.SPAR_ROOMS[m.key];
    const winReward = sparRoom?.showdown ? (sparRoom.prize || C.ECONOMY.SHOWDOWN_WIN) : C.ECONOMY.SPAR_WIN;
    for (const wid of winners) {
      const wp = this.players.get(wid);
      if (wp) {
        wp.wins++; wp.streak++;
        if (wp.streak > m.championStreak) { m.championStreak = wp.streak; m.championName = wp.name; }
        if (wp.accountEmail) {
          const c = db.adjustCoins(wp.accountEmail, winReward);
          if (c !== false) wp.coins = c;
          db.incrementStat(wp.accountEmail, 'wins', 1);
        }
      }
    }
    for (const lid of losers) {
      const lp = this.players.get(lid);
      if (lp) {
        lp.losses++; lp.streak = 0;
        if (lp.accountEmail) db.incrementStat(lp.accountEmail, 'losses', 1);
      }
    }
    this.io.emit('matchResult', {sparKey:m.key, winnerName, winners, losers, reason});
    setTimeout(() => {
      for (const sid of m.fighters) {
        // Remove bot
        if (this.bots.has(sid)) { this.bots.delete(sid); continue; }
        const p = this.players.get(sid);
        if (p) {
          p.matchKey = null; p.role = 'free';
          const r = C.SPAR_ROOMS[m.key];
          const qm = r.queueMarker;
          p.x = qm.x; p.y = qm.y + 24;
          p.hp = p.maxHP = C.PLAYER.maxHP;
          p.alive = true;
        }
      }
      m.fighters = []; m.state = 'idle';
      this._tryStartMatch(m);
      this._broadcastRoom();
    }, 4000);
  }

  _endMatchByDisconnect(m, leaverId) {
    const remaining = m.fighters.filter(id => id !== leaverId);
    if (!remaining.length) { m.state = 'idle'; m.fighters = []; return; }
    // If only a bot remains, just clean up
    if (remaining.every(id => this.bots.has(id))) {
      for (const id of remaining) this.bots.delete(id);
      m.fighters = []; m.state = 'idle'; return;
    }
    if (m.key === 'twos') {
      const teamA = [m.fighters[0], m.fighters[1]];
      const leftA = teamA.includes(leaverId);
      const winners = leftA ? [m.fighters[2], m.fighters[3]].filter(Boolean) : teamA.filter(id => id !== leaverId);
      this._endMatch(m, winners.length ? winners : [remaining[0]], 'disconnect');
    } else {
      this._endMatch(m, remaining[0], 'disconnect');
    }
  }

  // ── Shop ─────────────────────────────────────────────────────
  purchaseItem(sid, itemId) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    if (!p.accountEmail) { this.io.to(sid).emit('shopResult',{ok:false, msg:'sign in to buy'}); return; }
    const item = C.SHOP_ITEMS[itemId];
    if (!item) { this.io.to(sid).emit('shopResult',{ok:false, msg:'unknown item'}); return; }
    const res = db.purchaseItem(p.accountEmail, itemId, item);
    if (res.ok) {
      p.coins = res.coins;
      p.owned = res.owned;
      this.io.to(sid).emit('shopResult', {ok:true, itemId, coins:p.coins, owned:p.owned});
    } else {
      this.io.to(sid).emit('shopResult', {ok:false, msg:res.msg});
    }
  }

  equipItem(sid, slot, itemId) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    if (!p.accountEmail) return;
    if (db.equipItem(p.accountEmail, itemId, slot)) {
      p.equipped[slot] = itemId || null;
      this.io.to(sid).emit('equipped', {slot, itemId, equipped:p.equipped});
    }
  }

  // ── Squads ───────────────────────────────────────────────────
  squadCreate(sid, name) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    if (!p.accountEmail) { this.io.to(sid).emit('squadResult',{ok:false, msg:'sign in to create squad'}); return; }
    if (p.coins < C.ECONOMY.SQUAD_CREATE_COST) { this.io.to(sid).emit('squadResult',{ok:false, msg:'need 200 coins'}); return; }
    const res = db.createSquad(p.accountEmail, name);
    if (res.ok) {
      db.adjustCoins(p.accountEmail, -C.ECONOMY.SQUAD_CREATE_COST);
      p.coins -= C.ECONOMY.SQUAD_CREATE_COST;
      p.squadId = res.squad.id; p.squadName = res.squad.name;
      this.io.to(sid).emit('squadResult', {ok:true, squad:res.squad, coins:p.coins});
    } else {
      this.io.to(sid).emit('squadResult', {ok:false, msg:res.msg});
    }
  }

  squadJoin(sid, squadId) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    if (!p.accountEmail) { this.io.to(sid).emit('squadResult',{ok:false, msg:'sign in to join squad'}); return; }
    const res = db.joinSquad(p.accountEmail, squadId);
    if (res.ok) {
      p.squadId = squadId; p.squadName = res.squad.name;
      this.io.to(sid).emit('squadResult', {ok:true, squad:res.squad});
    } else {
      this.io.to(sid).emit('squadResult', {ok:false, msg:res.msg});
    }
  }

  squadLeave(sid) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    if (!p.accountEmail || !p.squadId) return;
    db.leaveSquad(p.accountEmail);
    p.squadId = null; p.squadName = null;
    this.io.to(sid).emit('squadResult', {ok:true, left:true});
  }

  squadList(sid) {
    const p = this.players.get(sid); if (!p) return;
    const all = db.getAllSquads().map(s => ({id:s.id, name:s.name, memberCount:s.members.length, vaultHoldSec:s.vaultHoldSec, hatUnlocked:s.hatUnlocked}));
    let mySquad = null;
    if (p.squadId) {
      const s = db.getSquad(p.squadId);
      if (s) {
        mySquad = {
          id:s.id, name:s.name, owner:s.owner,
          members:s.members.map(em => {
            const acc = db.getAccount(em);
            return {email:em, name:acc?.name || '?', online:!!this._findPlayerByEmail(em)};
          }),
          vaultHoldSec:s.vaultHoldSec, hatUnlocked:s.hatUnlocked,
        };
      }
    }
    this.io.to(sid).emit('squadList', {all, mySquad});
  }

  _findPlayerByEmail(email) {
    for (const [,p] of this.players) if (p.accountEmail === email) return p;
    return null;
  }

  // ── Job ──────────────────────────────────────────────────────
  jobStart(sid) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    if (!p.accountEmail) { this.io.to(sid).emit('jobResult',{ok:false, msg:'sign in to work'}); return; }
    // Must be near job NPC
    const nx = C.LOBBY.JOB_NPC.x, ny = C.LOBBY.JOB_NPC.y;
    if (Math.hypot(p.x - nx, p.y - ny) > 60) { this.io.to(sid).emit('jobResult',{ok:false, msg:'go to bartender'}); return; }
    const res = Job.startShift(p);
    this.io.to(sid).emit('jobResult', res);
  }
  jobPour(sid, color) {
    const p = this.players.get(sid); if (!p || !p.rateCheck('action')) return;
    Job.pourBottle(p, color);
  }
  jobEnd(sid) {
    const p = this.players.get(sid); if (!p) return;
    Job.endShift(p);
  }

  // ── Tick ─────────────────────────────────────────────────────
  _tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.05);
    this.lastTick = now;

    // Match timers
    for (const key in this.matches) {
      const m = this.matches[key];
      if (m.state === 'countdown') {
        m.cdTimer -= dt;
        if (m.cdTimer <= 0) {
          m.cdTimer = 1.0; m.cdVal--;
          if (m.cdVal <= 0) this._startFight(m);
          else this.io.emit('matchState', {sparKey:m.key, state:'countdown', val:m.cdVal});
        }
      }
      if (m.state === 'result') m.resultTimer -= dt;
      if (m.state === 'fighting') {
        m.matchTimer -= dt;
        if (m.matchTimer <= 0) {
          if (m.key === 'twos') {
            const t1 = [m.fighters[0],m.fighters[1]].reduce((s,id) => s + (this.players.get(id)?.hp || 0), 0);
            const t2 = [m.fighters[2],m.fighters[3]].reduce((s,id) => s + (this.players.get(id)?.hp || 0), 0);
            this._endMatch(m, t1 >= t2 ? [m.fighters[0],m.fighters[1]] : [m.fighters[2],m.fighters[3]], 'timeout');
          } else {
            const getHP = (id) => this.players.get(id)?.hp ?? this.bots.get(id)?.hp ?? 0;
            const a = getHP(m.fighters[0]);
            const b = getHP(m.fighters[1]);
            this._endMatch(m, a >= b ? m.fighters[0] : m.fighters[1], 'timeout');
          }
        }
      }
    }

    // Vehicles
    for (const v of this.vehicles) {
      if (v.riderId) {
        const rider = this.players.get(v.riderId);
        if (!rider) { v.riderId = null; continue; }
        // Prevent vehicle into spar/pk/vault entry
        const inp = rider.input;
        let mvx = inp.dx, mvy = inp.dy;
        const ml = Math.hypot(mvx, mvy);
        if (ml > 1) { mvx /= ml; mvy /= ml; }
        v.vx = mvx * C.VEHICLE.speed; v.vy = mvy * C.VEHICLE.speed;
        v.x += v.vx * dt; v.y += v.vy * dt;
        // Vehicle angle tracks movement direction (smoothed)
        if (ml > 0.1) {
          const target = Math.atan2(mvy, mvx);
          let da = target - v.angle;
          while (da > Math.PI) da -= Math.PI*2;
          while (da < -Math.PI) da += Math.PI*2;
          v.angle += da * Math.min(1, dt * 8);
        }
        for (const w of this.walls) {
          const nx = Math.max(w.x, Math.min(v.x, w.x + w.w));
          const ny = Math.max(w.y, Math.min(v.y, w.y + w.h));
          const dx = v.x - nx, dy = v.y - ny, d2 = dx*dx + dy*dy, r = C.VEHICLE.radius;
          if (d2 < r * r) {
            const d = Math.sqrt(d2) || 0.001;
            v.x += (dx/d) * (r - d);
            v.y += (dy/d) * (r - d);
          }
        }
        v.x = Math.max(C.PERIMETER.x+20, Math.min(C.PERIMETER.x+C.PERIMETER.w-20, v.x));
        v.y = Math.max(C.PERIMETER.y+20, Math.min(C.PERIMETER.y+C.PERIMETER.h-20, v.y));
        rider.x = v.x; rider.y = v.y;
        rider.angle = inp.angle || rider.angle;
        const z = zoneOf(v.x, v.y);
        if (z.type === 'spar') this.dismountVehicle(v.riderId);
      }
    }

    // Players
    for (const [, p] of this.players) {
      // Job tick
      Job.tick(p, dt);

      // Auto-stand from seat on movement input
      if (p.inSeat && p.input && (p.input.dx || p.input.dy)) {
        this._freeAnySeat(p);
        this._broadcastRoom();
      }

      if (p.vehicleId) {
        // Mounted: skip movement (vehicle controls position), but allow shooting
        if (p.fireCooldown > 0) p.fireCooldown -= dt;
        if (p.reloading) { p.reloadTimer -= dt; if (p.reloadTimer <= 0) { p.reloading = false; p.ammo = C.WEAPONS[p.weapon].magazine || 0; } }
        if (p.chatTimer > 0) { p.chatTimer -= dt; if (p.chatTimer <= 0) p.chatBubble = null; }
        p.zone = zoneOf(p.x, p.y);
        // Allow firing while in pk/vault/event (no spar from vehicle)
        const inp = p.input || {};
        const canShoot = (p.zone.type === 'pk' || p.zone.type === 'vault');
        if (canShoot && inp.shoot && !p.reloading && p.fireCooldown <= 0) {
          const wdef = C.WEAPONS[p.weapon];
          if (wdef && wdef.type !== 'melee' && p.ammo > 0) {
            p.ammo--;
            p.fireCooldown = 1 / wdef.fireRate;
            for (let i = 0; i < wdef.pellets; i++) {
              const spr = (Math.random() - 0.5) * wdef.spread * 2;
              const ang = (inp.angle || p.angle) + spr;
              this.bullets.push({
                id:Date.now()+Math.random(), ownerId:p.id,
                x:p.x + Math.cos(ang) * (C.PLAYER.radius + 14),
                y:p.y + Math.sin(ang) * (C.PLAYER.radius + 14),
                vx:Math.cos(ang) * wdef.bulletSpeed,
                vy:Math.sin(ang) * wdef.bulletSpeed,
                damage:wdef.damage, lifetime:C.BULLET_LIFETIME, weapon:p.weapon,
              });
            }
          }
        }
        if (inp.reload && !p.reloading) {
          const wdef = C.WEAPONS[p.weapon];
          if (wdef && wdef.magazine > 0 && p.ammo < wdef.magazine) {
            p.reloading = true; p.reloadTimer = wdef.reloadTime;
          }
        }
        // Allow weapon switch (1-5) while mounted
        if (inp.weapon && C.WEAPONS[inp.weapon] && inp.weapon !== p.weapon) {
          p.setWeapon(inp.weapon);
        }
        continue;
      }
      const newB = p.tick(dt, this.walls);
      for (const b of newB) {
        if (b.melee) this._processMelee(b, p);
        else this.bullets.push(b);
      }
    }

    // Bots — AI and combat (spar bots + PK bots)
    for (const [, bot] of this.bots) {
      if (bot.mode === 'pk') {
        // PK wanderer — find nearest PK player as target
        if (!bot.alive) {
          bot.respawnTimer = (bot.respawnTimer ?? 4) - dt;
          if (bot.respawnTimer <= 0) { this._respawnPkBot(bot); bot.respawnTimer = 4; }
          continue;
        }
        let target = null, td = 360;
        for (const [, p] of this.players) {
          if (!p.alive || p.zone.type !== 'pk') continue;
          const d = Math.hypot(p.x - bot.x, p.y - bot.y);
          if (d < td) { td = d; target = p; }
        }
        // Wander zone-bound — keep bot inside PK
        bot.zone = { type:'pk', room:C.PK };
        const newB = bot.tick(dt, this.walls, target);
        // Constrain to PK rect
        bot.x = Math.max(C.PK.x + 20, Math.min(C.PK.x + C.PK.w - 20, bot.x));
        bot.y = Math.max(C.PK.y + 20, Math.min(C.PK.y + C.PK.h - 20, bot.y));
        for (const b of newB) {
          if (b.melee) this._processMelee(b, bot);
          else this.bullets.push(b);
        }
        continue;
      }
      // Spar bot
      const m = this.matches[bot.matchKey];
      if (!m || m.state !== 'fighting') continue;
      const oppId = m.fighters.find(id => id !== bot.id);
      const opp = this.players.get(oppId);
      const newB = bot.tick(dt, this.walls, opp);
      for (const b of newB) {
        if (b.melee) this._processMelee(b, bot);
        else this.bullets.push(b);
      }
    }

    // Vault
    this.vault.tick(dt);
    this._tickRace(dt);
    this._tickWarps();

    // Vault coin reward — squad owns? give each member +1 coin/min while in vault zone
    this.vaultCoinAccum += dt;
    if (this.vaultCoinAccum >= 60) {
      this.vaultCoinAccum = 0;
      const owner = db.getCurrentVaultOwner();
      if (owner) {
        for (const [, p] of this.players) {
          if (p.squadId === owner.id && p.zone.type === 'vault' && p.accountEmail) {
            const c = db.adjustCoins(p.accountEmail, C.ECONOMY.VAULT_OWN_COIN_PER_MIN);
            if (c !== false) p.coins = c;
          }
        }
      }
    }

    // Bullets
    const dead = [];
    for (const b of this.bullets) {
      const px = b.x, py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt; b.lifetime -= dt;
      if (b.lifetime <= 0) { dead.push(b); continue; }
      if (bulletHitsWall(px, py, b.x, b.y, this.walls) !== null) { dead.push(b); continue; }
      // Check vault hit
      if (this.vault.testBulletHit(b)) {
        const shooter = this.players.get(b.ownerId);
        if (shooter && shooter.zone.type === 'vault') {
          this.vault.applyDamage(b.damage, shooter);
        }
        dead.push(b);
        continue;
      }
      // Player hit
      let hitBot = false;
      for (const [, bot] of this.bots) {
        if (bot.id === b.ownerId || !bot.alive) continue;
        const shooterIsP = this.players.get(b.ownerId);
        if (!shooterIsP) continue;
        // PK bot — hit if shooter is in PK zone
        if (bot.mode === 'pk') {
          if (shooterIsP.zone.type !== 'pk') continue;
        } else {
          // Spar bot — only hit by same-match fighter
          if (shooterIsP.matchKey !== bot.matchKey || shooterIsP.role !== 'fighter') continue;
        }
        if (Math.hypot(b.x - bot.x, b.y - bot.y) <= C.PLAYER.radius + C.BULLET_RADIUS) {
          const dmg = bot.takeDamage(b.damage);
          this.io.emit('hit', {targetId:bot.id, damage:dmg, bx:b.x, by:b.y, weapon:b.weapon});
          dead.push(b); hitBot = true;
          if (!bot.alive) {
            if (bot.mode === 'pk') {
              // Reward shooter, schedule respawn
              if (shooterIsP.accountEmail) {
                const c = db.adjustCoins(shooterIsP.accountEmail, C.ECONOMY.PK_KILL);
                if (c !== false) shooterIsP.coins = c;
              }
              this.io.emit('pkKill', {killerName:shooterIsP.name, victimName:bot.name});
              bot.respawnTimer = 4;
            } else {
              this._onBotKilled(bot, shooterIsP);
            }
          }
          break;
        }
      }
      if (hitBot) continue;
      for (const [sid, p] of this.players) {
        if (sid === b.ownerId || !p.alive) continue;
        let shooter = this.players.get(b.ownerId);
        const botShooter = this.bots.get(b.ownerId);
        if (botShooter) {
          // PK bot — hit any PK player
          if (botShooter.mode === 'pk') {
            if (p.zone.type !== 'pk') continue;
          } else {
            if (botShooter.matchKey !== p.matchKey || p.role !== 'fighter') continue;
          }
          if (Math.hypot(b.x - p.x, b.y - p.y) <= C.PLAYER.radius + C.BULLET_RADIUS) {
            const dmg = p.takeDamage(b.damage);
            this.io.emit('hit', {targetId:sid, damage:dmg, bx:b.x, by:b.y, weapon:b.weapon});
            dead.push(b);
            if (!p.alive) {
              if (botShooter.mode === 'pk') {
                p.losses++; p.streak = 0;
                p.respawnTimer = C.PK.respawn;
                this.io.emit('pkKill', {killerName:botShooter.name, victimName:p.name});
              } else {
                this._onPlayerKilledByBot(p, botShooter);
              }
            }
            break;
          }
          continue;
        }
        if (!shooter) continue;
        const inSameSpar = p.matchKey && p.matchKey === shooter.matchKey && p.role === 'fighter' && shooter.role === 'fighter';
        const bothPK    = p.zone.type === 'pk' && shooter.zone.type === 'pk';
        const bothVault = p.zone.type === 'vault' && shooter.zone.type === 'vault';
        // Killzone: outside spar match, outside safe area, neither in spar
        const bothInKillzone = !p.matchKey && !shooter.matchKey
                              && !isSafe(p.x, p.y) && !isSafe(shooter.x, shooter.y)
                              && p.zone.type !== 'spar' && shooter.zone.type !== 'spar';
        if (!inSameSpar && !bothPK && !bothVault && !bothInKillzone) continue;
        // Friendly fire in 2v2
        if (inSameSpar && p.matchKey === 'twos') {
          const m = this.matches['twos'];
          if (m) {
            const teamA = [m.fighters[0],m.fighters[1]];
            if (teamA.includes(sid) === teamA.includes(b.ownerId)) continue;
          }
        }
        // Squad friendly fire off in vault zone
        if (bothVault && p.squadId && shooter.squadId && p.squadId === shooter.squadId) continue;
        if (Math.hypot(b.x - p.x, b.y - p.y) <= C.PLAYER.radius + C.BULLET_RADIUS) {
          const dmg = p.takeDamage(b.damage);
          this.io.emit('hit', {targetId:sid, damage:dmg, bx:b.x, by:b.y, weapon:b.weapon});
          dead.push(b);
          if (!p.alive) this._onKill(p, shooter, inSameSpar);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter(b => !dead.includes(b));

    this._broadcastSnap();
  }

  _processMelee(swing, owner) {
    const ownerIsBot = owner.isBot;
    // Bot swinger → only hit their player opponent
    if (ownerIsBot) {
      for (const [sid, p] of this.players) {
        if (!p.alive) continue;
        if (p.matchKey !== owner.matchKey || p.role !== 'fighter') continue;
        const dx = p.x - owner.x, dy = p.y - owner.y;
        const dist = Math.hypot(dx, dy);
        if (dist > swing.range + C.PLAYER.radius) continue;
        const tAng = Math.atan2(dy, dx);
        let diff = tAng - swing.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > 0.9) continue;
        const dmg = p.takeDamage(swing.damage);
        this.io.emit('hit', {targetId:sid, damage:dmg, bx:p.x, by:p.y, weapon:'blade'});
        if (!p.alive) this._onPlayerKilledByBot(p, owner);
      }
      this.io.emit('swing', {x:swing.x, y:swing.y, angle:swing.angle, range:swing.range, ownerId:swing.ownerId});
      return;
    }
    // Player swinger → hit bots first, then players
    for (const [, bot] of this.bots) {
      if (!bot.alive) continue;
      if (bot.matchKey !== owner.matchKey) continue;
      const dx = bot.x - owner.x, dy = bot.y - owner.y;
      const dist = Math.hypot(dx, dy);
      if (dist > swing.range + C.PLAYER.radius) continue;
      const tAng = Math.atan2(dy, dx);
      let diff = tAng - swing.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.9) continue;
      const dmg = bot.takeDamage(swing.damage);
      this.io.emit('hit', {targetId:bot.id, damage:dmg, bx:bot.x, by:bot.y, weapon:'blade'});
      if (!bot.alive) this._onBotKilled(bot, owner);
    }
    for (const [sid, p] of this.players) {
      if (sid === owner.id || !p.alive) continue;
      const inSameSpar = p.matchKey && p.matchKey === owner.matchKey && p.role === 'fighter' && owner.role === 'fighter';
      const bothPK    = p.zone.type === 'pk' && owner.zone.type === 'pk';
      const bothVault = p.zone.type === 'vault' && owner.zone.type === 'vault';
      const bothInKillzone = !p.matchKey && !owner.matchKey
                            && !isSafe(p.x, p.y) && !isSafe(owner.x, owner.y)
                            && p.zone.type !== 'spar' && owner.zone.type !== 'spar';
      if (!inSameSpar && !bothPK && !bothVault && !bothInKillzone) continue;
      if (inSameSpar && p.matchKey === 'twos') {
        const m = this.matches['twos'];
        if (m) { const teamA = [m.fighters[0],m.fighters[1]]; if (teamA.includes(sid) === teamA.includes(owner.id)) continue; }
      }
      if (bothVault && p.squadId && owner.squadId && p.squadId === owner.squadId) continue;
      const dx = p.x - owner.x, dy = p.y - owner.y;
      const dist = Math.hypot(dx, dy);
      if (dist > swing.range + C.PLAYER.radius) continue;
      const tAng = Math.atan2(dy, dx);
      let diff = tAng - swing.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.9) continue;
      const dmg = p.takeDamage(swing.damage);
      this.io.emit('hit', {targetId:sid, damage:dmg, bx:p.x, by:p.y, weapon:'blade'});
      if (!p.alive) this._onKill(p, owner, inSameSpar);
    }
    this.io.emit('swing', {x:swing.x, y:swing.y, angle:swing.angle, range:swing.range, ownerId:swing.ownerId});
  }

  _onBotKilled(bot, killer) {
    // Bot died — player wins
    const m = this.matches[bot.matchKey];
    if (!m || m.state !== 'fighting') return;
    this._endMatch(m, killer.id, 'kill');
  }

  _onPlayerKilledByBot(victim, bot) {
    const m = this.matches[bot.matchKey];
    if (!m || m.state !== 'fighting') return;
    this._endMatch(m, bot.id, 'kill');
  }

  _onKill(victim, killer, inSameSpar) {
    // Glitch patch: free vehicle if rider dies
    if (victim.vehicleId) {
      const v = this.vehicles.find(v => v.id === victim.vehicleId);
      if (v) { v.riderId = null; v.vx = 0; v.vy = 0; }
      victim.vehicleId = null;
    }
    // Killzone (anywhere outside spar match + outside pk/vault)
    if (!inSameSpar && victim.zone.type !== 'pk' && victim.zone.type !== 'vault') {
      killer.streak++;
      victim.losses++; victim.streak = 0;
      victim.respawnTimer = 3;
      if (killer.accountEmail) {
        const c = db.adjustCoins(killer.accountEmail, C.ECONOMY.KILLZONE_KILL || 50);
        if (c !== false) killer.coins = c;
      }
      this.io.emit('pkKill', {killerName:killer.name, victimName:victim.name});
      return;
    }
    if (victim.zone.type === 'pk') {
      killer.pkKills = (killer.pkKills || 0) + 1;
      killer.streak++;
      victim.losses++; victim.streak = 0;
      victim.respawnTimer = C.PK.respawn;
      // event respawns at event spawn; pk respawns at pk spawn (handled by Player respawn)
      if (killer.accountEmail) {
        const c = db.adjustCoins(killer.accountEmail, C.ECONOMY.PK_KILL);
        if (c !== false) killer.coins = c;
        db.incrementStat(killer.accountEmail, 'pkKills', 1);
      }
      this.io.emit('pkKill', {killerName:killer.name, victimName:victim.name});
    } else if (victim.zone.type === 'vault') {
      killer.streak++;
      victim.respawnTimer = C.VAULT_ZONE.respawn;
      if (killer.accountEmail) {
        const c = db.adjustCoins(killer.accountEmail, C.ECONOMY.VAULT_KILL);
        if (c !== false) killer.coins = c;
        db.incrementStat(killer.accountEmail, 'vaultKills', 1);
      }
      this.io.emit('pkKill', {killerName:killer.name, victimName:victim.name, vault:true});
    } else if (inSameSpar) {
      const m = this.matches[victim.matchKey];
      if (m && (m.state === 'fighting' || m.state === 'countdown')) {
        const room = C.SPAR_ROOMS[victim.matchKey];
        if (room && room.showdown) {
          // Showdown FFA: eject dead to lobby
          victim.matchKey = null;
          victim.role = 'free';
          victim.hp = victim.maxHP = C.PLAYER.maxHP;
          victim.alive = true;
          const sa = C.LOBBY.SPAWN_AREA;
          victim.x = sa.x + sa.w/2 + (Math.random()-0.5)*80;
          victim.y = sa.y + sa.h/2 + (Math.random()-0.5)*80;
          // Check if only 1 fighter left alive
          const aliveIds = m.fighters.filter(id => {
            const fp = this.players.get(id); return fp && fp.matchKey === m.key && fp.alive;
          });
          if (aliveIds.length === 1) this._endMatch(m, aliveIds[0], 'showdown');
          else if (aliveIds.length === 0) {
            m.state = 'idle'; m.fighters = [];
            this.io.emit('matchState', {sparKey:m.key, state:'idle'});
          }
        } else if (victim.matchKey === 'twos') {
          const teamA = [m.fighters[0], m.fighters[1]];
          const teamAAlive = teamA.filter(id => this.players.get(id)?.alive).length;
          const teamBAlive = m.fighters.filter(id => !teamA.includes(id)).filter(id => this.players.get(id)?.alive).length;
          if (teamAAlive === 0) this._endMatch(m, m.fighters.filter(id => !teamA.includes(id)), 'kill');
          else if (teamBAlive === 0) this._endMatch(m, teamA, 'kill');
        } else {
          const other = m.fighters.find(id => id !== victim.id);
          this._endMatch(m, other, 'kill');
        }
      }
    }
  }

  // ── Broadcast ────────────────────────────────────────────────
  _broadcastRoom() {
    const matches = {};
    for (const k in this.matches) {
      const m = this.matches[k];
      matches[k] = {
        state:m.state,
        fighters:m.fighters.map(id => { const p = this.players.get(id); return p ? {id, name:p.name} : null; }).filter(Boolean),
        queue:m.queue.map(id => { const p = this.players.get(id); return p ? {id, name:p.name} : null; }).filter(Boolean),
        championName:m.championName, championStreak:m.championStreak,
        matchTimer:Math.ceil(m.matchTimer),
      };
    }
    const seats = [
      ...this.lobbySeats.map(s => ({id:s.id, x:s.x, y:s.y, type:s.type, occupied:!!s.occupant, kind:s.kind})),
      ...this.specSeats.map(s => ({id:s.id, x:s.x, y:s.y, type:s.type, occupied:!!s.occupant, kind:s.kind, sparKey:s.sparKey})),
      ...this.loungeSeats.map(s => ({id:s.id, x:s.x, y:s.y, type:s.type, occupied:!!s.occupant, kind:s.kind})),
    ];
    const online = [];
    for (const [id, p] of this.players) online.push({id, name:p.name, squadName:p.squadName});
    this.io.emit('roomInfo', {total:this.players.size, max:C.MAX_PLAYERS, matches, seats, online});
  }

  _broadcastSnap() {
    const players = [];
    for (const [, p] of this.players) players.push(p.toSnap());
    for (const [, b] of this.bots) players.push(b.toSnap());
    const vehs = this.vehicles.map(v => ({id:v.id, x:v.x, y:v.y, riderId:v.riderId, angle:v.angle||0}));
    this.io.emit('snapshot', {
      players,
      bullets:this.bullets.map(b => ({id:b.id, x:b.x, y:b.y, vx:b.vx, vy:b.vy, weapon:b.weapon})),
      vehicles:vehs,
      vault:this.vault.snap(),
    });
  }
}

module.exports = GameRoom;
