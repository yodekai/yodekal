// server/index.js — v6 with accounts
'use strict';
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const GameRoom   = require('./game/GameRoom');
const db         = require('./db');

const PORT = process.env.PORT || 3000;
const app  = express();
const srv  = http.createServer(app);
const io   = new Server(srv, {cors:{origin:'*'}, maxHttpBufferSize:1e6});

app.use(express.static(path.join(__dirname, '../client')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, '../client/index.html')));

const room = new GameRoom(io);

function sanitizeColor(c, f) {
  return (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) ? c : f;
}

io.on('connection', socket => {
  console.log(`[+] ${socket.id}`);

  // ── Login / Account ──────────────────────────────────────────
  socket.on('login', ({email}) => {
    if (!email) { socket.emit('loginResult', {ok:false, msg:'email required'}); return; }
    const e = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { socket.emit('loginResult', {ok:false, msg:'invalid email'}); return; }
    const acc = db.getAccount(e);
    if (!acc) { socket.emit('loginResult', {ok:false, msg:'no account — sign up first'}); return; }
    socket.emit('loginResult', {ok:true, account:_publicAcc(acc)});
  });

  socket.on('signup', ({email, name, profile}) => {
    if (!email || !name) { socket.emit('loginResult', {ok:false, msg:'email and name required'}); return; }
    const e = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { socket.emit('loginResult', {ok:false, msg:'invalid email'}); return; }
    if (db.getAccount(e)) { socket.emit('loginResult', {ok:false, msg:'email already used — login instead'}); return; }
    const acc = db.getOrCreateAccount(e, {
      name: String(name).slice(0,16).replace(/[<>]/g,''),
      bodyColor:   sanitizeColor(profile?.bodyColor,   '#4a6090'),
      accentColor: sanitizeColor(profile?.accentColor, '#5aafff'),
      headColor:   sanitizeColor(profile?.headColor,   '#e8c8a0'),
      hairColor:   sanitizeColor(profile?.hairColor,   '#3a2a1a'),
      bio: profile?.bio || '',
    });
    socket.emit('loginResult', {ok:true, account:_publicAcc(acc)});
  });

  socket.on('join', payload => {
    if (room.players.size >= 30) { socket.emit('roomFull'); return; }
    // payload = { email (or null), name, bodyColor, accentColor, headColor, hairColor, bio }
    let profile;
    if (payload.email) {
      const acc = db.getAccount(payload.email);
      if (!acc) { socket.emit('roomFull'); return; }
      profile = {
        accountEmail: acc.email,
        name: acc.name,
        bodyColor: acc.profile.bodyColor,
        accentColor: acc.profile.accentColor,
        headColor: acc.profile.headColor,
        hairColor: acc.profile.hairColor,
        bio: acc.profile.bio,
        equipped: acc.equipped,
        owned: acc.owned,
        coins: acc.coins,
        wins: acc.wins, losses: acc.losses, pkKills: acc.pkKills,
        squadId: acc.squadId,
      };
    } else {
      // guest
      profile = {
        accountEmail: null,
        name: String(payload.name || 'Guest').slice(0,16).replace(/[<>]/g,''),
        bodyColor:   sanitizeColor(payload.bodyColor,   '#4a6090'),
        accentColor: sanitizeColor(payload.accentColor, '#5aafff'),
        headColor:   sanitizeColor(payload.headColor,   '#e8c8a0'),
        hairColor:   sanitizeColor(payload.hairColor,   '#3a2a1a'),
        bio: String(payload.bio || '').slice(0,120).replace(/[<>]/g,''),
        equipped: {gunSkin:null, head:null, body:null},
        owned: [],
        coins: 500,
      };
    }
    room.addPlayer(socket.id, profile);
    socket.emit('joined', {id:socket.id, name:profile.name, chatLog:room.chatLog, isGuest:!profile.accountEmail});
    socket.emit('chessState', {board:room.chess, turn:room.chessMoveTurn});
    io.emit('playerJoined', {name:profile.name});
  });

  socket.on('input',           d => room.receiveInput(socket.id, d));
  socket.on('chat',     ({text}) => room.receiveChat(socket.id, text));
  socket.on('emote',     ({key}) => room.receiveEmote(socket.id, key));
  socket.on('dm', ({targetId, text}) => room.receiveDM(socket.id, targetId, text));
  socket.on('updateBio', ({bio}) => room.updateBio(socket.id, bio));
  socket.on('updateAppearance', (d) => room.updateAppearance(socket.id, d));
  socket.on('chessMove', (d) => room.chessMove(socket.id, d));
  socket.on('chessReset', () => room.chessReset(socket.id));
  socket.on('joinRaceQueue', () => room.joinRaceQueue(socket.id));
  socket.on('leaveRaceQueue', () => room.leaveRaceQueue(socket.id));
  socket.on('sitDown', ({seatId}) => room.sitDown(socket.id, seatId));
  socket.on('standUp',        () => room.standUp(socket.id));
  socket.on('mountVehicle', ({vehicleId}) => room.mountVehicle(socket.id, vehicleId));
  socket.on('dismountVehicle', () => room.dismountVehicle(socket.id));
  socket.on('joinQueue', ({sparKey}) => room.joinQueue(socket.id, sparKey));
  socket.on('leaveQueue',({sparKey}) => room.leaveQueue(socket.id, sparKey));
  socket.on('joinQueueBot', ({sparKey, difficulty}) => room.joinQueueBot(socket.id, sparKey, difficulty));
  socket.on('unstickMe',   () => room.unstickMe(socket.id));
  socket.on('giftCoins',   ({targetId, amount}) => room.giftCoins(socket.id, targetId, amount));

  // Shop
  socket.on('shopBuy',    ({itemId})       => room.purchaseItem(socket.id, itemId));
  socket.on('shopEquip',  ({slot, itemId}) => room.equipItem(socket.id, slot, itemId));

  // Squad
  socket.on('squadCreate', ({name})    => room.squadCreate(socket.id, name));
  socket.on('squadJoin',   ({squadId}) => room.squadJoin(socket.id, squadId));
  socket.on('squadLeave',  ()          => room.squadLeave(socket.id));
  socket.on('squadList',   ()          => room.squadList(socket.id));

  // Job
  socket.on('jobStart',  ()        => room.jobStart(socket.id));
  socket.on('jobPour',   ({color}) => room.jobPour(socket.id, color));
  socket.on('jobEnd',    ()        => room.jobEnd(socket.id));

  socket.on('disconnect', () => {
    const p = room.players.get(socket.id);
    if (p) {
      console.log(`[-] ${p.name}`);
      io.emit('playerLeft', {name:p.name});
      room.removePlayer(socket.id);
    }
  });
});

function _publicAcc(acc) {
  return {
    email:acc.email, name:acc.name, profile:acc.profile,
    equipped:acc.equipped, owned:acc.owned, coins:acc.coins,
    wins:acc.wins, losses:acc.losses, pkKills:acc.pkKills,
    squadId:acc.squadId,
  };
}

srv.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ╔══════════════════════════════════╗`);
  console.log(`  ║   VAULTZONE  v6.19                ║`);
  console.log(`  ║   http://localhost:${PORT}          ║`);
  console.log(`  ╚══════════════════════════════════╝\n`);
});

// Graceful shutdown: flush vault hold time
function shutdown() { db.flushVaultHoldTime(); process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
