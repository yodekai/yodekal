// client/game.js — VaultZone v6
'use strict';
const C = SHARED;
let socket = null;
let myId = null, myName = '—', isGuest = true, myEmail = null;
let snapshot = {players:[], bullets:[], vehicles:[], vault:{hp:2500,maxHP:2500,ownerSquadId:null}};
let roomInfo = {total:0, max:30, matches:{}, seats:[], online:[]};
let effects = []; let floats = []; let swings = [];
let chatLog = []; let dmThreads = {}; let dmActiveTid = null;
let cam = {x:0, y:0, tx:0, ty:0, focus:false};
const KEY = {}; let mouse = {x:0, y:0, down:false};
let inp = {dx:0, dy:0, angle:0, shoot:false, reload:false, dash:false, weapon:null};
let lastInputT = 0;
let myShopCat = 'gunSkin';
let myShopTab = 'classic';
let lastNpcType = null;
let mySquadCache = null;
let _ownedCache = [];

const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d');
function resize() {
  const wrap = document.getElementById('canvas-wrap');
  canvas.width = wrap.clientWidth; canvas.height = wrap.clientHeight;
}
window.addEventListener('resize', resize);

// ─── Login screen ───────────────────────────────────────────
const swatchesData = {body:C.BODY_COLORS, accent:C.ACCENT_COLORS, head:C.HEAD_COLORS, hair:C.HAIR_COLORS};
let suSel = {body:C.BODY_COLORS[0], accent:C.ACCENT_COLORS[0], head:C.HEAD_COLORS[0], hair:C.HAIR_COLORS[0]};

function _buildSwatches() {
  for (const k of ['body','accent','head','hair']) {
    const el = document.getElementById('su-sw-'+k); if (!el) continue;
    el.innerHTML = '';
    for (const c of swatchesData[k]) {
      const s = document.createElement('div');
      s.className = 'swatch' + (c === suSel[k] ? ' sel' : '');
      s.style.background = c;
      s.onclick = () => { suSel[k] = c; _buildSwatches(); _drawPreview(); };
      el.appendChild(s);
    }
  }
}
function _drawPreview() {
  const pc = document.getElementById('preview-canvas'); if (!pc) return;
  const c = pc.getContext('2d');
  c.clearRect(0,0,90,110);
  c.save(); c.translate(45,60);
  c.fillStyle = suSel.body;   c.fillRect(-10,0,20,28);
  c.fillStyle = suSel.accent; c.fillRect(-10,8,20,3);
  c.fillStyle = suSel.head;   c.beginPath(); c.arc(0,-8,10,0,Math.PI*2); c.fill();
  c.fillStyle = suSel.hair;   c.fillRect(-10,-18,20,5);
  c.restore();
}
_buildSwatches(); _drawPreview();

function loginTab(t) {
  document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === t));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.toggle('active', el.id === 'tab-'+t));
}
window.loginTab = loginTab;

function _connectSocket() {
  if (socket) return socket;
  socket = io({transports:['websocket','polling']});
  _wireSocket();
  return socket;
}

function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const err = document.getElementById('login-err'); err.textContent = '';
  if (!email) { err.textContent = 'Enter your email.'; return; }
  _connectSocket();
  socket.emit('login', {email});
}
function doSignup() {
  const email = document.getElementById('signup-email').value.trim();
  const name  = document.getElementById('signup-name').value.trim();
  const err = document.getElementById('signup-err'); err.textContent = '';
  if (!email || !name) { err.textContent = 'Email and callsign required.'; return; }
  _connectSocket();
  socket.emit('signup', {email, name, profile:{
    bodyColor:suSel.body, accentColor:suSel.accent, headColor:suSel.head, hairColor:suSel.hair,
  }});
}
function doGuest() {
  const name = (document.getElementById('guest-name').value.trim()) || ('Guest_'+Math.floor(Math.random()*9999));
  myName = name; myEmail = null; isGuest = true;
  _connectSocket();
  socket.emit('join', {email:null, name,
    bodyColor:suSel.body, accentColor:suSel.accent, headColor:suSel.head, hairColor:suSel.hair, bio:''});
}
window.doLogin = doLogin; window.doSignup = doSignup; window.doGuest = doGuest;

window.addEventListener('load', () => {
  const saved = localStorage.getItem('vz_email');
  if (saved) document.getElementById('login-email').value = saved;
});

// ─── Socket wiring ─────────────────────────────────────────
function _wireSocket() {
  socket.on('loginResult', ({ok, account, msg}) => {
    if (!ok) {
      const tab = document.querySelector('.tab.active')?.dataset.tab;
      const id = tab === 'signup' ? 'signup-err' : 'login-err';
      document.getElementById(id).textContent = msg;
      return;
    }
    myEmail = account.email; myName = account.name; isGuest = false;
    localStorage.setItem('vz_email', myEmail);
    _ownedCache = account.owned || [];
    socket.emit('join', {email:myEmail});
  });
  socket.on('joined', ({id, name, chatLog:cl, isGuest:g}) => {
    myId = id; myName = name; isGuest = g;
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('tb-myname').textContent = name + (g ? ' (guest)' : '');
    resize();
    chatLog = cl || [];
    _renderChat();
    if (!isGuest) socket.emit('squadList');
  });
  socket.on('roomFull', () => alert('Server full — try again later.'));
  socket.on('roomInfo', d => { roomInfo = d; document.getElementById('tb-players').textContent = `${d.total} online`; _updateMatchHud(); });
  socket.on('snapshot', s => { snapshot = s; _updateHudFromSnap(); });
  socket.on('matchState', d => _onMatchState(d));
  socket.on('matchResult', d => _onMatchResult(d));
  socket.on('chatMsg', m => { chatLog.push(m); if (chatLog.length>80) chatLog.shift(); _renderChat(); _miniChat(m); });
  socket.on('dm', _onDM);
  socket.on('hit', _onHit);
  socket.on('swing', _onSwing);
  socket.on('pkKill', _onPkKill);
  socket.on('playerJoined', ({name}) => _elog(`${name} joined`));
  socket.on('playerLeft', ({name}) => _elog(`${name} left`));
  socket.on('vaultBreach', d => _pkFeed(`💥 ${d.newOwnerName || 'no one'} claims the VAULT (${d.killerName})`, true));
  socket.on('shopResult', d => _onShopResult(d));
  socket.on('equipped', d => _renderShop());
  socket.on('squadResult', d => _onSquadResult(d));
  socket.on('squadList', d => _onSquadList(d));
  socket.on('jobResult', d => _onJobResult(d));
  socket.on('tradeResult', d => _onTradeResult(d));
  socket.on('teleported', d => { _elog(`✦ teleported to ${d.zone}`); });
}

// ─── Match HUD ─────────────────────────────────────────────
function _updateMatchHud() {
  const mh = document.getElementById('match-hud');
  const me = snapshot.players.find(p => p.id === myId);
  if (!me || !me.matchKey) { mh.style.display = 'none'; return; }
  const m = roomInfo.matches[me.matchKey]; if (!m || m.state !== 'fighting') { mh.style.display = 'none'; return; }
  mh.style.display = 'flex';
  document.getElementById('match-title').textContent = C.SPAR_ROOMS[me.matchKey].label;
  const fs = m.fighters;
  if (me.matchKey === 'twos') {
    const a1 = snapshot.players.find(p => p.id === fs[0]?.id), a2 = snapshot.players.find(p => p.id === fs[1]?.id);
    const b1 = snapshot.players.find(p => p.id === fs[2]?.id), b2 = snapshot.players.find(p => p.id === fs[3]?.id);
    const ahp = ((a1?.hp||0) + (a2?.hp||0)), bhp = ((b1?.hp||0) + (b2?.hp||0));
    const amx = ((a1?.maxHP||1) + (a2?.maxHP||1)), bmx = ((b1?.maxHP||1) + (b2?.maxHP||1));
    document.getElementById('mh-na').textContent = `${fs[0]?.name||'?'}+${fs[1]?.name||'?'}`;
    document.getElementById('mh-nb').textContent = `${fs[2]?.name||'?'}+${fs[3]?.name||'?'}`;
    document.getElementById('mh-fa').style.width = (ahp/amx*100)+'%';
    document.getElementById('mh-fb').style.width = (bhp/bmx*100)+'%';
  } else {
    const a = snapshot.players.find(p => p.id === fs[0]?.id), b = snapshot.players.find(p => p.id === fs[1]?.id);
    document.getElementById('mh-na').textContent = a?.name || '?';
    document.getElementById('mh-nb').textContent = b?.name || '?';
    document.getElementById('mh-fa').style.width = ((a?.hp||0)/(a?.maxHP||1)*100)+'%';
    document.getElementById('mh-fb').style.width = ((b?.hp||0)/(b?.maxHP||1)*100)+'%';
  }
  const t = document.getElementById('mh-timer');
  t.textContent = m.matchTimer + 's';
  t.classList.toggle('danger', m.matchTimer < 15);
}

function _onMatchState(d) {
  // Countdown removed in v6.1 — matches start instantly
}
function _onMatchResult(d) {
  const me = snapshot.players.find(p => p.id === myId);
  if (!me || me.matchKey !== d.sparKey) return;
  const rb = document.getElementById('result-box');
  rb.style.display = 'flex';
  const iWon = d.winners?.includes(myId);
  document.getElementById('rb-winner').textContent = iWon ? '★ VICTORY ★' : 'DEFEAT';
  document.getElementById('rb-winner').style.color = iWon ? '#80ffa0' : '#e08060';
  document.getElementById('rb-reward').textContent = iWon ? '+500 ⌬' : '';
  setTimeout(() => { rb.style.display = 'none'; }, 3500);
}

// ─── HUD updates from snapshot ─────────────────────────────
function _updateHudFromSnap() {
  const me = snapshot.players.find(p => p.id === myId); if (!me) return;
  document.getElementById('tb-coins').textContent = me.coins;
  const sq = document.getElementById('tb-squad');
  if (me.squadName) { sq.style.display = ''; sq.textContent = '◆ ' + me.squadName; } else sq.style.display = 'none';
  const zlabels = {lobby:'LOBBY', spar:'SPAR', pk:'PK ZONE', vault:'VAULT ZONE', upper:'SKY LOUNGE'};
  document.getElementById('tb-zone').textContent = zlabels[me.zone] || me.zone.toUpperCase();
  const vh = document.getElementById('vault-hud');
  if (me.zone === 'vault') {
    vh.style.display = 'flex';
    document.getElementById('vault-fill').style.width = (snapshot.vault.hp / snapshot.vault.maxHP * 100) + '%';
    let ownerName = 'neutral';
    if (snapshot.vault.ownerSquadId) {
      ownerName = (mySquadCache?.id === snapshot.vault.ownerSquadId) ? ('your squad ['+mySquadCache.name+']') : 'contested';
    }
    document.getElementById('vault-owner').textContent = ownerName;
  } else vh.style.display = 'none';

  const fh = document.getElementById('fighter-hud');
  if (me.role === 'fighter' || me.zone === 'pk' || me.zone === 'vault') {
    fh.style.display = 'flex';
    document.getElementById('fh-hpfill').style.width = (me.hp / me.maxHP * 100) + '%';
    document.getElementById('fh-hpnum').textContent = Math.ceil(me.hp);
    const wd = C.WEAPONS[me.weapon];
    document.getElementById('fh-weapon').textContent = wd?.name || '—';
    document.getElementById('fh-ammo').textContent = wd?.magazine ? `${me.ammo}/${wd.magazine}` : 'melee';
    document.getElementById('fh-streak').textContent = '✦ ' + me.streak;
    document.getElementById('fh-streak').style.display = me.streak ? 'inline' : 'none';
  } else fh.style.display = 'none';

  _updateWeaponSel(me);
  _checkZonePrompt(me);
  _checkNpcProximity(me);
  _updateMatchHud();
  _refreshProfileIfMine(me);
  _updateJobUI(me);
}

// ─── Weapon selector ───────────────────────────────────────
function _updateWeaponSel(me) {
  const ws = document.getElementById('weapon-selector');
  if (ws.dataset.weapon === me.weapon) return;
  ws.dataset.weapon = me.weapon;
  ws.innerHTML = '';
  C.WEAPON_ORDER.forEach((id, i) => {
    const w = C.WEAPONS[id];
    const b = document.createElement('div');
    b.className = 'ws-btn' + (me.weapon === id ? ' active' : '');
    b.innerHTML = `<span class="key">${i+1}</span>${w.name}`;
    b.onclick = () => { inp.weapon = id; };
    ws.appendChild(b);
  });
}

// ─── Zone & NPC prompts ────────────────────────────────────
function _checkZonePrompt(me) {
  const zp = document.getElementById('zone-prompt');
  let nearSpar = null;
  for (const k in C.SPAR_ROOMS) {
    const r = C.SPAR_ROOMS[k];
    const ex = r.entry.x + r.entry.w/2, ey = r.entry.y + r.entry.h + 25;
    if (Math.hypot(me.x - ex, me.y - ey) < 90) { nearSpar = k; break; }
  }
  if (nearSpar && me.zone === 'lobby' && !me.matchKey) {
    zp.style.display = 'flex';
    const m = roomInfo.matches[nearSpar];
    const inQ = m?.queue.some(q => q.id === myId);
    document.getElementById('zp-label').textContent = C.SPAR_ROOMS[nearSpar].name.toUpperCase() + ' SPAR';
    document.getElementById('zp-sub').textContent = `${m?.fighters.length||0} fighting · ${m?.queue.length||0} in queue`;
    const btn = document.getElementById('zp-btn');
    btn.textContent = inQ ? 'LEAVE QUEUE (F)' : 'QUEUE UP (F)';
    btn.classList.toggle('inq', !!inQ);
    btn.dataset.spar = nearSpar; btn.dataset.inq = inQ ? '1' : '';
    const botBtn = document.getElementById('zp-bot-btn');
    // No bots for 2v2; only show when match is idle
    botBtn.style.display = (nearSpar === 'twos' || m?.state !== 'idle' || inQ) ? 'none' : '';
    botBtn.dataset.spar = nearSpar;
  } else zp.style.display = 'none';
}
function toggleQueue() {
  const btn = document.getElementById('zp-btn');
  const k = btn.dataset.spar; if (!k) return;
  if (btn.dataset.inq) socket.emit('leaveQueue', {sparKey:k});
  else socket.emit('joinQueue', {sparKey:k});
}
window.toggleQueue = toggleQueue;
function vsBot() {
  const k = document.getElementById('zp-bot-btn').dataset.spar; if (!k) return;
  socket.emit('joinQueueBot', {sparKey:k, difficulty:'medium'});
}
window.vsBot = vsBot;
function doUnstick() {
  if (socket) socket.emit('unstickMe');
}
window.doUnstick = doUnstick;

function _checkNpcProximity(me) {
  const np = document.getElementById('npc-prompt');
  if (me.zone === 'event') {
    // Show exit prompt if near the exit pad
    const ep = C.EVENT_HOUSE.EXIT_PAD;
    if (Math.abs(me.x - (ep.x + ep.w/2)) < 60 && Math.abs(me.y - (ep.y + ep.h/2)) < 60) {
      np.style.display = 'flex';
      document.getElementById('npc-label').textContent = '← EXIT EVENT HALL';
      document.getElementById('npc-sub').textContent = 'press F to leave';
      const action = () => socket.emit('exitEvent');
      document.getElementById('npc-btn').onclick = action;
      lastNpcType = {action};
      return;
    }
    np.style.display = 'none'; lastNpcType = null; return;
  }
  if (me.zone !== 'lobby' && me.zone !== 'upper') { np.style.display = 'none'; lastNpcType = null; return; }
  // Check event portal first (it's a region, not a point)
  const portal = C.LOBBY.EVENT_PORTAL;
  if (portal && me.x >= portal.x - 30 && me.x <= portal.x + portal.w + 30 && me.y >= portal.y - 30 && me.y <= portal.y + portal.h + 30) {
    np.style.display = 'flex';
    document.getElementById('npc-label').textContent = '★ ENTER EVENT HALL ★';
    document.getElementById('npc-sub').textContent = 'press F to teleport';
    const action = () => socket.emit('enterEvent');
    document.getElementById('npc-btn').onclick = action;
    lastNpcType = {action};
    return;
  }
  const npcs = [
    {pos:C.LOBBY.GUIDE_NPC,   label:'GUIDE',         action:() => toggleGuide()},
    {pos:C.LOBBY.SHOP_NPC,    label:'SHOP',          action:() => toggleShop()},
    {pos:C.LOBBY.SQUAD_NPC,   label:'SQUAD',         action:() => toggleSquad()},
    {pos:C.LOBBY.JOB_NPC,     label:'BARTENDER JOB', action:() => startJob()},
    {pos:C.LOBBY.PROFILE_NPC, label:'YOUR PROFILE',  action:() => openProfile(myId)},
    {pos:C.LOBBY.TRADE_NPC_A, label:'TRADE TABLE A', action:() => openTrade()},
    {pos:C.LOBBY.TRADE_NPC_B, label:'TRADE TABLE B', action:() => openTrade()},
  ];
  let near = null;
  for (const n of npcs) { if (n.pos && Math.hypot(me.x - n.pos.x, me.y - n.pos.y) < 55) { near = n; break; } }
  if (near) {
    np.style.display = 'flex';
    document.getElementById('npc-label').textContent = near.label;
    document.getElementById('npc-sub').textContent = 'press F to interact';
    document.getElementById('npc-btn').onclick = near.action;
    lastNpcType = near;
  } else { np.style.display = 'none'; lastNpcType = null; }
}
function tryInteractNPC() {
  if (lastNpcType) lastNpcType.action();
  else if (document.getElementById('zone-prompt').style.display === 'flex') toggleQueue();
}
window.tryInteractNPC = tryInteractNPC;

// ─── Camera ────────────────────────────────────────────────
function _updateCamera(me) {
  if (me.seatKind === 'spec' && me.spectatingSpar && C.SPAR_ROOMS[me.spectatingSpar]) {
    const r = C.SPAR_ROOMS[me.spectatingSpar];
    cam.tx = r.x + r.w/2 - canvas.width/2;
    cam.ty = r.y + r.h/2 - canvas.height/2;
    cam.focus = true;
  } else {
    cam.tx = me.x - canvas.width/2;
    cam.ty = me.y - canvas.height/2;
    cam.focus = false;
  }
  const lerp = cam.focus ? 0.08 : 0.18;
  cam.x += (cam.tx - cam.x) * lerp;
  cam.y += (cam.ty - cam.y) * lerp;
  cam.x = Math.max(0, Math.min(C.WORLD.W - canvas.width, cam.x));
  cam.y = Math.max(0, Math.min(C.WORLD.H - canvas.height, cam.y));
}
function worldToScreen(x, y) { return {x:x - cam.x, y:y - cam.y}; }
function screenToWorld(x, y) { return {x:x + cam.x, y:y + cam.y}; }

// ─── Drawing helpers ───────────────────────────────────────

// ─── Tile pattern cache (per-zone) ────────────────────────
const TILE = 28;
const _patternCache = {};
function _makeTilePattern(baseHex, lineHex, accentHex, speckHex, seed=1) {
  const oc = document.createElement('canvas');
  oc.width = TILE; oc.height = TILE;
  const c = oc.getContext('2d');
  c.fillStyle = baseHex; c.fillRect(0,0,TILE,TILE);
  // grid lines
  c.fillStyle = lineHex;
  c.fillRect(0,0,TILE,1);
  c.fillRect(0,0,1,TILE);
  // inner highlight (top-left lighter)
  c.fillStyle = accentHex;
  c.fillRect(1,1,2,1); c.fillRect(1,1,1,2);
  // bottom-right shadow speck
  c.fillStyle = speckHex;
  c.fillRect(TILE-3, TILE-3, 2, 2);
  // pseudo-random polish (deterministic per pattern)
  const s = seed * 9301 + 49297;
  const px = (s % 13) + 6;
  const py = ((s >> 3) % 13) + 6;
  c.fillStyle = accentHex;
  c.fillRect(px, py, 1, 1);
  return ctx.createPattern(oc, 'repeat');
}
function _getPattern(zoneKey) {
  if (_patternCache[zoneKey]) return _patternCache[zoneKey];
  let p;
  switch(zoneKey) {
    case 'lobby':   p = _makeTilePattern('#181c26','#0e1018','#2a3045','#0a0c14', 1); break;
    case 'spar':    p = _makeTilePattern('#1c2434','#0c1018','#3a4a68','#0a0e16', 2); break;
    case 'pk':      p = _makeTilePattern('#241418','#100608','#4a2030','#0a0406', 3); break;
    case 'vault':   p = _makeTilePattern('#1c1a14','#0c0a06','#4a3818','#080604', 4); break;
    case 'upper':   p = _makeTilePattern('#1e1c22','#0e0c10','#3a3038','#0a080c', 5); break;
    case 'arena':   p = _makeTilePattern('#202838','#10141c','#4a5a78','#0a0e16', 6); break;
    default:        p = _makeTilePattern('#181c26','#0e1018','#2a3045','#0a0c14', 99);
  }
  _patternCache[zoneKey] = p;
  return p;
}

function _drawFloor(rect, zoneKey) {
  const a = worldToScreen(rect.x, rect.y);
  ctx.save();
  // align pattern to world coords so it doesn't slide under camera
  ctx.translate(a.x - (rect.x % TILE), a.y - (rect.y % TILE));
  ctx.fillStyle = _getPattern(zoneKey);
  ctx.fillRect(rect.x % TILE, rect.y % TILE, rect.w, rect.h);
  ctx.restore();
  // soft inner vignette (depth)
  const grd = ctx.createLinearGradient(a.x, a.y, a.x, a.y + rect.h);
  grd.addColorStop(0, 'rgba(0,0,0,0.35)');
  grd.addColorStop(0.15, 'rgba(0,0,0,0)');
  grd.addColorStop(0.85, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = grd;
  ctx.fillRect(a.x, a.y, rect.w, rect.h);
}

function _drawWalls(walls) {
  // drop shadow underneath
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  for (const w of walls) {
    const a = worldToScreen(w.x, w.y);
    ctx.fillRect(a.x + 2, a.y + 4, w.w, w.h);
  }
  // main wall body
  for (const w of walls) {
    const a = worldToScreen(w.x, w.y);
    const grd = ctx.createLinearGradient(0, a.y, 0, a.y + w.h);
    grd.addColorStop(0, '#2a3245');
    grd.addColorStop(0.5, '#1c2030');
    grd.addColorStop(1, '#10141c');
    ctx.fillStyle = grd;
    ctx.fillRect(a.x, a.y, w.w, w.h);
    // top highlight
    ctx.fillStyle = 'rgba(120,140,180,0.32)';
    ctx.fillRect(a.x, a.y, w.w, 1);
    // bottom inner shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(a.x, a.y + w.h - 1, w.w, 1);
  }
}

function _drawNeon(n) {
  const a = worldToScreen(n.x, n.y);
  ctx.save();
  // glow pool on floor beneath
  const pool = ctx.createRadialGradient(a.x, a.y + 10, 0, a.x, a.y + 10, 60);
  pool.addColorStop(0, n.color + '40');
  pool.addColorStop(1, n.color + '00');
  ctx.fillStyle = pool;
  ctx.fillRect(a.x - 70, a.y - 10, 140, 80);
  // text
  ctx.font = `bold ${n.size||12}px Courier New`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = n.color; ctx.shadowBlur = 18;
  ctx.fillStyle = n.color;
  ctx.fillText(n.text, a.x, a.y);
  // sharper inner
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.6;
  ctx.fillText(n.text, a.x, a.y);
  ctx.restore();
}

function _drawWindows(arr) {
  for (const w of arr) {
    const a = worldToScreen(w.x, w.y);
    // frame
    ctx.fillStyle = '#0a0e14'; ctx.fillRect(a.x-3, a.y-3, w.w+6, w.h+6);
    // glass with night-sky gradient
    const grd = ctx.createLinearGradient(0, a.y, 0, a.y+w.h);
    grd.addColorStop(0, '#1a2848'); grd.addColorStop(0.5, '#2a3a5a'); grd.addColorStop(1, '#4a5a78');
    ctx.fillStyle = grd; ctx.fillRect(a.x, a.y, w.w, w.h);
    // sparkle
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(a.x + 5, a.y + 2, 2, 1);
    ctx.fillRect(a.x + w.w - 14, a.y + 6, 1, 1);
    // light spill on floor below
    const spill = ctx.createLinearGradient(0, a.y + w.h, 0, a.y + w.h + 24);
    spill.addColorStop(0, 'rgba(120,150,200,0.18)');
    spill.addColorStop(1, 'rgba(120,150,200,0)');
    ctx.fillStyle = spill;
    ctx.fillRect(a.x - 4, a.y + w.h, w.w + 8, 24);
  }
}

function _drawNoSmokingSign(s) {
  const a = worldToScreen(s.x, s.y);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(a.x+1, a.y+2, 10, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(a.x, a.y, 9, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#e02020'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(a.x, a.y, 8, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(a.x-6, a.y-6); ctx.lineTo(a.x+6, a.y+6); ctx.stroke();
  ctx.fillStyle = '#000'; ctx.fillRect(a.x-4, a.y-1, 8, 2);
  ctx.restore();
}

// Cached walls for client rendering — mirrors server Worldgen
let WALLS_CACHE = null;
function _getWalls() {
  if (WALLS_CACHE) return WALLS_CACHE;
  const walls = [];
  const T = 12, P = C.PERIMETER;
  walls.push({x:P.x, y:P.y, w:P.w, h:T});
  walls.push({x:P.x, y:P.y+P.h-T, w:P.w, h:T});
  walls.push({x:P.x, y:P.y, w:T, h:P.h});
  walls.push({x:P.x+P.w-T, y:P.y, w:T, h:P.h});

  function addRoom(r, openings) {
    const sides = [
      {x:r.x, y:r.y, w:r.w, h:T, axis:'h'},
      {x:r.x, y:r.y+r.h-T, w:r.w, h:T, axis:'h'},
      {x:r.x, y:r.y, w:T, h:r.h, axis:'v'},
      {x:r.x+r.w-T, y:r.y, w:T, h:r.h, axis:'v'},
    ];
    for (const s of sides) {
      let segs = [{x:s.x, y:s.y, w:s.w, h:s.h, axis:s.axis}];
      for (const o of openings) {
        const next = [];
        for (const seg of segs) {
          const overlap = !(o.x+o.w<seg.x || o.x>seg.x+seg.w || o.y+o.h<seg.y || o.y>seg.y+seg.h);
          if (!overlap) { next.push(seg); continue; }
          if (seg.axis==='h') {
            const lft = {x:seg.x, y:seg.y, w:Math.max(0, o.x-seg.x), h:seg.h, axis:'h'};
            const rgt = {x:o.x+o.w, y:seg.y, w:Math.max(0,(seg.x+seg.w)-(o.x+o.w)), h:seg.h, axis:'h'};
            if (lft.w > 4) next.push(lft); if (rgt.w > 4) next.push(rgt);
          } else {
            const top = {x:seg.x, y:seg.y, w:seg.w, h:Math.max(0, o.y-seg.y), axis:'v'};
            const bot = {x:seg.x, y:o.y+o.h, w:seg.w, h:Math.max(0,(seg.y+seg.h)-(o.y+o.h)), axis:'v'};
            if (top.h > 4) next.push(top); if (bot.h > 4) next.push(bot);
          }
        }
        segs = next;
      }
      for (const seg of segs) walls.push({x:seg.x, y:seg.y, w:seg.w, h:seg.h});
    }
  }
  for (const k in C.SPAR_ROOMS) addRoom(C.SPAR_ROOMS[k], [C.SPAR_ROOMS[k].entry]);
  addRoom(C.PK, [C.PK.entry, C.PK.vaultEntry]);
  for (const c of C.PK.covers) walls.push({...c});
  addRoom(C.VAULT_ZONE, [C.VAULT_ZONE.entry]);
  for (const c of C.VAULT_ZONE.covers) walls.push({...c});
  addRoom(C.UPPER_LOUNGE, [C.UPPER_LOUNGE.ESCALATOR_OPENING]);
  const bc = C.LOBBY.BAR_COUNTER; walls.push({x:bc.x, y:bc.y, w:bc.w, h:bc.h});
  for (const t of C.LOBBY.TABLES) walls.push({x:t.x, y:t.y, w:t.w, h:t.h});
  for (const t of C.UPPER_LOUNGE.TABLES) walls.push({x:t.x, y:t.y, w:t.w, h:t.h});
  const ub = C.UPPER_LOUNGE.BAR; walls.push({x:ub.x, y:ub.y, w:ub.w, h:ub.h});
  WALLS_CACHE = walls; return walls;
}

function _drawWorld(walls) {
  // Background — deep void
  ctx.fillStyle = '#06080d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Base world floor (covers all walkable areas inside perimeter)
  const P = C.PERIMETER;
  _drawFloor({x:P.x, y:P.y, w:P.w, h:P.h}, 'lobby');

  // Lobby region — overlay slightly warmer tone with carpet accents
  const lobby = C.LOBBY;
  _drawFloor({x:lobby.x, y:lobby.y, w:lobby.w, h:lobby.h}, 'lobby');
  // central runner — single magenta-tinged carpet down center
  const cr = worldToScreen(lobby.x + lobby.w/2 - 360, lobby.y + 280);
  const crW = 720, crH = 700;
  const cgrd = ctx.createLinearGradient(cr.x, cr.y, cr.x, cr.y + crH);
  cgrd.addColorStop(0, '#1c1018'); cgrd.addColorStop(0.5, '#2a1424'); cgrd.addColorStop(1, '#1c1018');
  ctx.fillStyle = cgrd; ctx.fillRect(cr.x, cr.y, crW, crH);
  ctx.strokeStyle = '#5a2848'; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
  ctx.strokeRect(cr.x + 4, cr.y + 4, crW - 8, crH - 8);
  ctx.globalAlpha = 1;

  // Spar rooms — futuristic arena tiles + center medallion
  for (const k in C.SPAR_ROOMS) {
    const r = C.SPAR_ROOMS[k];
    _drawFloor(r.floor, 'arena');
    // entry threshold strip — neon under-glow
    const e = r.entry; const ea = worldToScreen(e.x, e.y);
    const eg = ctx.createLinearGradient(0, ea.y, 0, ea.y + e.h);
    eg.addColorStop(0, '#404858'); eg.addColorStop(0.5, r.neon.color + '40'); eg.addColorStop(1, '#1c2030');
    ctx.fillStyle = eg; ctx.fillRect(ea.x, ea.y, e.w, e.h);
    // threshold light strip
    ctx.fillStyle = r.neon.color + 'cc';
    ctx.shadowColor = r.neon.color; ctx.shadowBlur = 8;
    ctx.fillRect(ea.x, ea.y + e.h - 3, e.w, 2);
    ctx.shadowBlur = 0;
    // center arena medallion (concentric rings + faint room name)
    const cx = r.floor.x + r.floor.w/2, cy = r.floor.y + r.floor.h/2;
    const cs = worldToScreen(cx, cy);
    ctx.save();
    // outer glow pool
    const pool = ctx.createRadialGradient(cs.x, cs.y, 0, cs.x, cs.y, 90);
    pool.addColorStop(0, r.neon.color + '20');
    pool.addColorStop(1, r.neon.color + '00');
    ctx.fillStyle = pool;
    ctx.fillRect(cs.x - 90, cs.y - 90, 180, 180);
    ctx.strokeStyle = r.neon.color + '50'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cs.x, cs.y, 50, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = r.neon.color + '28';
    ctx.beginPath(); ctx.arc(cs.x, cs.y, 72, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = r.neon.color + '22';
    ctx.font = 'bold 30px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(r.name.toUpperCase(), cs.x, cs.y);
    ctx.restore();
    _drawNeon(r.neon);
    const lbl = worldToScreen(r.x + r.w/2, r.y + 26);
    ctx.fillStyle = '#80a0c0'; ctx.font = '9px Courier New'; ctx.textAlign = 'center';
    ctx.fillText(r.label, lbl.x, lbl.y);

    // ── Sparrers Up Next queue board (futuristic LED panel) ──
    _drawQueueBoard(r, k);
  }

  // Bar counter (back shelf, main counter, bottles)
  const bc = lobby.BAR_COUNTER; const bca = worldToScreen(bc.x, bc.y);
  ctx.fillStyle = '#1a1218'; ctx.fillRect(bca.x, bca.y - 32, bc.w, 26);
  ctx.fillStyle = '#3a2820'; ctx.fillRect(bca.x + 2, bca.y - 30, bc.w - 4, 22);
  // bottles on shelf
  const bottleColors = ['#80c060','#a07040','#5070a0','#a04060','#ffd040','#c060c0','#40c0c0','#ff6080'];
  const nBottles = Math.floor(bc.w / 75);
  for (let i = 0; i < nBottles; i++) {
    const bx = bc.x + 24 + i * 75, by = bc.y - 26;
    const ba = worldToScreen(bx, by);
    ctx.fillStyle = bottleColors[i % bottleColors.length];
    ctx.fillRect(ba.x, ba.y, 6, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(ba.x + 1, ba.y + 1, 1, 5);
  }
  // counter — brass + dark wood
  const bcgrd = ctx.createLinearGradient(0, bca.y, 0, bca.y + bc.h);
  bcgrd.addColorStop(0, '#7a5028'); bcgrd.addColorStop(0.5, '#502818'); bcgrd.addColorStop(1, '#2a1408');
  ctx.fillStyle = bcgrd; ctx.fillRect(bca.x, bca.y, bc.w, bc.h);
  ctx.fillStyle = '#c08840'; ctx.fillRect(bca.x, bca.y, bc.w, 3);
  ctx.fillStyle = 'rgba(255,210,140,0.4)'; ctx.fillRect(bca.x, bca.y, bc.w, 1);

  // Tables with depth
  for (const t of lobby.TABLES) {
    const a = worldToScreen(t.x, t.y);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(a.x + 2, a.y + 4, t.w, t.h);
    const tg = ctx.createLinearGradient(0, a.y, 0, a.y + t.h);
    tg.addColorStop(0, '#5a3820'); tg.addColorStop(1, '#3a2010');
    ctx.fillStyle = tg; ctx.fillRect(a.x, a.y, t.w, t.h);
    ctx.fillStyle = '#7a4828'; ctx.fillRect(a.x, a.y, t.w, 2);
  }

  _drawWindows(lobby.WINDOWS);
  for (const n of lobby.NEON_SIGNS) _drawNeon(n);
  for (const s of lobby.NO_SMOKING_SIGNS) _drawNoSmokingSign(s);

  // Escalator — chrome rails + animated steps
  const es = lobby.ESCALATOR; const esa = worldToScreen(es.x, es.y);
  ctx.fillStyle = '#1a1e28'; ctx.fillRect(esa.x - 4, esa.y - 4, es.w + 8, es.h + 8);
  ctx.fillStyle = '#5a6478'; ctx.fillRect(esa.x, esa.y, 6, es.h);
  ctx.fillStyle = '#5a6478'; ctx.fillRect(esa.x + es.w - 6, esa.y, 6, es.h);
  const tt = (Date.now() / 50) % 20;
  for (let yy = -20; yy < es.h; yy += 20) {
    const fy = ((yy + tt) % (es.h + 20));
    const stepG = ctx.createLinearGradient(0, esa.y + fy, 0, esa.y + fy + 16);
    stepG.addColorStop(0, '#3a4458'); stepG.addColorStop(0.5, '#2a3245'); stepG.addColorStop(1, '#10141c');
    ctx.fillStyle = stepG;
    ctx.fillRect(esa.x + 8, esa.y + fy, es.w - 16, 14);
    ctx.fillStyle = '#5a6478'; ctx.fillRect(esa.x + 8, esa.y + fy, es.w - 16, 1);
  }
  ctx.fillStyle = '#ffd040'; ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center';
  ctx.shadowColor = '#ffd040'; ctx.shadowBlur = 6;
  ctx.fillText('→ SKY LOUNGE', esa.x + es.w/2, esa.y - 6);
  ctx.shadowBlur = 0;

  // NPCs
  function _drawNpc(pos, label, color) {
    const a = worldToScreen(pos.x, pos.y);
    ctx.save();
    const pulse = 0.7 + 0.3 * Math.sin(Date.now()/400);
    const pool = ctx.createRadialGradient(a.x, a.y + 6, 0, a.x, a.y + 6, 36);
    pool.addColorStop(0, color + '60');
    pool.addColorStop(1, color + '00');
    ctx.fillStyle = pool; ctx.fillRect(a.x - 40, a.y - 20, 80, 60);
    ctx.strokeStyle = color + (Math.floor(pulse * 96).toString(16).padStart(2,'0'));
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(a.x, a.y, 22 * pulse, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(a.x + 1, a.y + 4, 10, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(a.x, a.y, 9, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(a.x - 2, a.y - 2, 3, 0, Math.PI*2); ctx.fill();
    ctx.font = 'bold 7px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(10,12,18,0.92)';
    ctx.fillRect(a.x - tw/2, a.y + 14, tw, 11);
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.strokeRect(a.x - tw/2 + 0.5, a.y + 14.5, tw - 1, 10);
    ctx.fillStyle = color;
    ctx.fillText(label, a.x, a.y + 20);
    ctx.restore();
  }
  _drawNpc(lobby.GUIDE_NPC,   'GUIDE',     '#80a8d0');
  _drawNpc(lobby.SHOP_NPC,    'SHOP',      '#ffd040');
  _drawNpc(lobby.SQUAD_NPC,   'SQUAD',     '#a0ffff');
  _drawNpc(lobby.JOB_NPC,     'BARTENDER', '#80ffc0');
  _drawNpc(lobby.PROFILE_NPC, 'PROFILE',   '#c0ffa0');
  _drawNpc(lobby.TRADE_NPC_A, 'TRADE',     '#ff90c0');
  _drawNpc(lobby.TRADE_NPC_B, 'TRADE',     '#ff90c0');

  // ── CYBERPUNK HOLOGRAM PLAZA (dead center) ──
  if (lobby.HOLOGRAM_PLAZA) {
    const hp = lobby.HOLOGRAM_PLAZA;
    const hpa = worldToScreen(hp.x, hp.y);
    const tt = Date.now() / 1000;

    // Hexagonal plaza floor — darker stone with neon inlay
    ctx.save();
    const plazaRadius = 180;
    // dark recessed floor
    ctx.fillStyle = 'rgba(8,10,18,0.9)';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const px = hpa.x + Math.cos(a) * plazaRadius;
      const py = hpa.y + Math.sin(a) * plazaRadius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();

    // Neon inlay ring (cyan)
    ctx.strokeStyle = '#40d0ff'; ctx.lineWidth = 2;
    ctx.shadowColor = '#40d0ff'; ctx.shadowBlur = 14;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const px = hpa.x + Math.cos(a) * (plazaRadius - 8);
      const py = hpa.y + Math.sin(a) * (plazaRadius - 8);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke();

    // Inner ring (magenta, counter-rotating)
    ctx.strokeStyle = '#ff4080'; ctx.lineWidth = 1;
    ctx.shadowColor = '#ff4080'; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(hpa.x, hpa.y, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Spinning hex pattern on floor (deck plates)
    for (let r = 30; r < 140; r += 24) {
      ctx.strokeStyle = `rgba(64,208,255,${0.3 - r * 0.0015})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + tt * 0.1 * (r % 48 ? 1 : -1);
        const px = hpa.x + Math.cos(a) * r;
        const py = hpa.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }

    // ── GIANT HOLOGRAPHIC VAULT (rotating, semi-transparent) ──
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.15 * Math.sin(tt * 2);
    ctx.translate(hpa.x, hpa.y - 8);

    // Holographic emission base (cone glow)
    const emit = ctx.createRadialGradient(0, 50, 0, 0, 50, 110);
    emit.addColorStop(0, 'rgba(64,208,255,0.45)');
    emit.addColorStop(1, 'rgba(64,208,255,0)');
    ctx.fillStyle = emit;
    ctx.beginPath();
    ctx.moveTo(-8, 50); ctx.lineTo(-90, -90); ctx.lineTo(90, -90); ctx.lineTo(8, 50);
    ctx.closePath(); ctx.fill();

    // Rotating wireframe vault cube (isometric-ish projection)
    ctx.rotate(Math.sin(tt * 0.3) * 0.2);
    const size = 50;
    ctx.strokeStyle = '#40d0ff'; ctx.lineWidth = 1.5;
    ctx.shadowColor = '#40d0ff'; ctx.shadowBlur = 10;
    // outer cube
    ctx.strokeRect(-size, -size - 20, size * 2, size * 2);
    // inner cube (depth)
    ctx.strokeStyle = '#80e0ff'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-size + 14, -size + 14 - 20); ctx.lineTo(size - 14, -size + 14 - 20);
    ctx.lineTo(size - 14, size - 14 - 20); ctx.lineTo(-size + 14, size - 14 - 20);
    ctx.closePath(); ctx.stroke();
    // connection lines (3D)
    ctx.beginPath();
    ctx.moveTo(-size, -size - 20); ctx.lineTo(-size + 14, -size + 14 - 20);
    ctx.moveTo(size, -size - 20); ctx.lineTo(size - 14, -size + 14 - 20);
    ctx.moveTo(-size, size - 20); ctx.lineTo(-size + 14, size - 14 - 20);
    ctx.moveTo(size, size - 20); ctx.lineTo(size - 14, size - 14 - 20);
    ctx.stroke();

    // Vault symbol inside
    ctx.fillStyle = '#80e0ff'; ctx.font = 'bold 38px Courier New';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⌬', 0, -20);

    // scan flicker
    ctx.strokeStyle = `rgba(255,255,255,${0.3 + Math.sin(tt * 8) * 0.3})`;
    ctx.lineWidth = 0.5;
    const scanY = ((tt * 30) % (size * 2)) - size - 20;
    ctx.beginPath(); ctx.moveTo(-size, scanY); ctx.lineTo(size, scanY); ctx.stroke();
    ctx.restore();
    ctx.restore();

    // ── HOLOGRAPHIC TEXT BANNERS (orbiting) ──
    const orbitR = 130;
    for (let i = 0; i < 3; i++) {
      const ang = tt * 0.4 + i * Math.PI * 2 / 3;
      const bx = hpa.x + Math.cos(ang) * orbitR;
      const by = hpa.y + Math.sin(ang) * orbitR * 0.4 - 40;
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.4 * Math.cos(ang);
      ctx.fillStyle = '#40d0ff';
      ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center';
      ctx.shadowColor = '#40d0ff'; ctx.shadowBlur = 6;
      const texts = ['VAULT.IO', '◆ 2026 ◆', 'NEON CITY'];
      ctx.fillText(texts[i], bx, by);
      ctx.restore();
    }

    // ── KIOSKS (urban density) ──
    for (const k of (lobby.KIOSKS || [])) {
      const ka = worldToScreen(k.x, k.y);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(ka.x + 2, ka.y + 4, k.w, k.h);
      // body
      const kg = ctx.createLinearGradient(0, ka.y, 0, ka.y + k.h);
      kg.addColorStop(0, '#2a2e3a'); kg.addColorStop(0.5, '#1a1e28'); kg.addColorStop(1, '#0a0e14');
      ctx.fillStyle = kg; ctx.fillRect(ka.x, ka.y, k.w, k.h);
      // screen
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(ka.x + 4, ka.y + 6, k.w - 8, 24);
      // screen glow
      ctx.fillStyle = k.color + '60';
      ctx.fillRect(ka.x + 4, ka.y + 6, k.w - 8, 24);
      // animated scan line on screen
      const scanO = ((tt * 20) % 24);
      ctx.fillStyle = k.color;
      ctx.fillRect(ka.x + 4, ka.y + 6 + scanO, k.w - 8, 1);
      // label
      ctx.fillStyle = k.color; ctx.font = 'bold 7px Courier New'; ctx.textAlign = 'center';
      ctx.shadowColor = k.color; ctx.shadowBlur = 4;
      ctx.fillText(k.label, ka.x + k.w / 2, ka.y + 22);
      ctx.shadowBlur = 0;
      // base/pedestal
      ctx.fillStyle = '#1a1e28';
      ctx.fillRect(ka.x - 2, ka.y + k.h - 4, k.w + 4, 4);
    }

    // ── HOLO-BILLBOARDS (tall vertical signs) ──
    for (const b of (lobby.BILLBOARDS || [])) {
      const ba = worldToScreen(b.x, b.y);
      const bw = 28, bh = 90;
      // pole
      ctx.fillStyle = '#2a2e3a'; ctx.fillRect(ba.x + bw / 2 - 2, ba.y + bh - 4, 4, 14);
      // screen frame
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(ba.x - 2, ba.y - 2, bw + 4, bh);
      ctx.fillStyle = '#0a0e14'; ctx.fillRect(ba.x, ba.y, bw, bh - 4);
      // glow background
      ctx.fillStyle = b.color + '24'; ctx.fillRect(ba.x, ba.y, bw, bh - 4);
      // text (3 lines)
      const lines = (b.text || '').split('\n');
      ctx.fillStyle = b.color; ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center';
      ctx.shadowColor = b.color; ctx.shadowBlur = 6;
      lines.forEach((ln, i) => {
        ctx.fillText(ln, ba.x + bw / 2, ba.y + 18 + i * 14);
      });
      ctx.shadowBlur = 0;
      // scan line
      const sy = ((tt * 16) % (bh - 4));
      ctx.fillStyle = b.color + '40'; ctx.fillRect(ba.x, ba.y + sy, bw, 1);
      // top blinker
      ctx.fillStyle = (Math.sin(tt * 4) > 0) ? b.color : 'rgba(0,0,0,0)';
      ctx.fillRect(ba.x + bw / 2 - 1, ba.y - 4, 2, 2);
    }

    // ── PLAZA BENCHES (urban seating density) ──
    for (const bn of (lobby.PLAZA_BENCHES || [])) {
      const bna = worldToScreen(bn.x, bn.y);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bna.x + 2, bna.y + 4, bn.w, bn.h);
      const bng = ctx.createLinearGradient(0, bna.y, 0, bna.y + bn.h);
      bng.addColorStop(0, '#2a2e3a'); bng.addColorStop(1, '#10141c');
      ctx.fillStyle = bng; ctx.fillRect(bna.x, bna.y, bn.w, bn.h);
      // glow strip along front
      ctx.fillStyle = '#40d0ff44'; ctx.fillRect(bna.x, bna.y + bn.h - 2, bn.w, 1);
    }
  }

  // Trade tables (physical surfaces)
  if (lobby.TRADE_TABLES) for (const t of lobby.TRADE_TABLES) {
    const ta = worldToScreen(t.x, t.y);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(ta.x + 2, ta.y + 4, t.w, t.h);
    const tg = ctx.createLinearGradient(0, ta.y, 0, ta.y + t.h);
    tg.addColorStop(0, '#3a1828'); tg.addColorStop(0.5, '#2a1018'); tg.addColorStop(1, '#1a0810');
    ctx.fillStyle = tg; ctx.fillRect(ta.x, ta.y, t.w, t.h);
    ctx.fillStyle = '#ff90c0'; ctx.fillRect(ta.x, ta.y, t.w, 2);
    // glow lines
    ctx.strokeStyle = '#ff90c044'; ctx.lineWidth = 1;
    ctx.strokeRect(ta.x + 6, ta.y + 6, t.w - 12, t.h - 12);
  }

  // Event portal
  if (lobby.EVENT_PORTAL) {
    const ep = lobby.EVENT_PORTAL;
    const epa = worldToScreen(ep.x, ep.y);
    const pulse = 0.6 + 0.4 * Math.sin(Date.now()/280);
    // outer glow pool
    const pool = ctx.createRadialGradient(epa.x + ep.w/2, epa.y + ep.h/2, 0, epa.x + ep.w/2, epa.y + ep.h/2, 70);
    pool.addColorStop(0, `rgba(192,160,255,${0.5 * pulse})`);
    pool.addColorStop(0.6, 'rgba(192,160,255,0.15)');
    pool.addColorStop(1, 'rgba(192,160,255,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(epa.x - 40, epa.y - 40, ep.w + 80, ep.h + 80);
    // portal frame
    ctx.fillStyle = '#0a0816';
    ctx.fillRect(epa.x, epa.y, ep.w, ep.h);
    // animated rings
    ctx.strokeStyle = `rgba(192,160,255,${pulse})`;
    ctx.lineWidth = 2;
    const cx = epa.x + ep.w/2, cy = epa.y + ep.h/2;
    for (let i = 0; i < 4; i++) {
      const ang = (Date.now()/600 + i * Math.PI/2) % (Math.PI*2);
      const rad = 14 + i * 6;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, ang, ang + Math.PI/1.4);
      ctx.stroke();
    }
    // center symbol
    ctx.fillStyle = '#c0a0ff'; ctx.font = 'bold 20px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#c0a0ff'; ctx.shadowBlur = 12;
    ctx.fillText('★', cx, cy);
    ctx.shadowBlur = 0;
  }

  // Event house — drawn only when player is inside (it's instanced via portal)
  const me = snapshot.players.find(p => p.id === myId);
  if (me && me.zone === 'event') {
    const eh = C.EVENT_HOUSE;
    _drawFloor(eh.floor, 'upper');
    // dance floor with checker pattern + animated colors
    const df = eh.DANCE_FLOOR;
    const dfa = worldToScreen(df.x, df.y);
    const checkSize = 32;
    const t = Date.now() / 200;
    for (let cy = 0; cy < df.h; cy += checkSize) {
      for (let cx = 0; cx < df.w; cx += checkSize) {
        const phase = ((cx/checkSize + cy/checkSize) % 2);
        const hue = (t + cx + cy) % 360;
        ctx.fillStyle = phase ? `hsl(${hue},60%,20%)` : `hsl(${(hue+60)%360},50%,12%)`;
        ctx.fillRect(dfa.x + cx, dfa.y + cy, Math.min(checkSize, df.w - cx), Math.min(checkSize, df.h - cy));
      }
    }
    // bar
    const eb = eh.BAR; const eba = worldToScreen(eb.x, eb.y);
    const ebg = ctx.createLinearGradient(0, eba.y, 0, eba.y + eb.h);
    ebg.addColorStop(0, '#7a3068'); ebg.addColorStop(1, '#2a0820');
    ctx.fillStyle = ebg; ctx.fillRect(eba.x, eba.y, eb.w, eb.h);
    ctx.fillStyle = '#ff60c0'; ctx.fillRect(eba.x, eba.y, eb.w, 2);
    // seats
    for (const s of eh.SEATS) {
      const sa = worldToScreen(s.x, s.y);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(sa.x + 1, sa.y + 2, 8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5a3060'; ctx.beginPath(); ctx.arc(sa.x, sa.y, 7, 0, Math.PI*2); ctx.fill();
    }
    // DJ booth (NPC)
    _drawNpc(eh.DJ_NPC, 'DJ', '#ff60c0');
    // exit pad
    const ep = eh.EXIT_PAD; const epa = worldToScreen(ep.x, ep.y);
    const epPulse = 0.5 + 0.5 * Math.sin(Date.now()/300);
    ctx.fillStyle = `rgba(255,128,80,${epPulse})`;
    ctx.fillRect(epa.x, epa.y, ep.w, ep.h);
    ctx.strokeStyle = '#ffa060'; ctx.lineWidth = 2;
    ctx.strokeRect(epa.x + 0.5, epa.y + 0.5, ep.w - 1, ep.h - 1);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Courier New'; ctx.textAlign = 'center';
    ctx.fillText('EXIT', epa.x + ep.w/2, epa.y + ep.h/2 + 3);
    for (const n of eh.NEON_SIGNS) _drawNeon(n);
  }

  // Upper lounge
  _drawFloor({x:C.UPPER_LOUNGE.x, y:C.UPPER_LOUNGE.y, w:C.UPPER_LOUNGE.w, h:C.UPPER_LOUNGE.h}, 'upper');
  const ub = C.UPPER_LOUNGE.BAR; const uba = worldToScreen(ub.x, ub.y);
  ctx.fillStyle = '#1a1018'; ctx.fillRect(uba.x, uba.y - 24, ub.w, 20);
  ctx.fillStyle = '#3a2418'; ctx.fillRect(uba.x + 2, uba.y - 22, ub.w - 4, 16);
  const ubgrd = ctx.createLinearGradient(0, uba.y, 0, uba.y + ub.h);
  ubgrd.addColorStop(0, '#8a6840'); ubgrd.addColorStop(0.5, '#5a3a20'); ubgrd.addColorStop(1, '#2a1a08');
  ctx.fillStyle = ubgrd; ctx.fillRect(uba.x, uba.y, ub.w, ub.h);
  ctx.fillStyle = '#e0b060'; ctx.fillRect(uba.x, uba.y, ub.w, 2);
  for (const t of C.UPPER_LOUNGE.TABLES) {
    const a = worldToScreen(t.x, t.y);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(a.x + 2, a.y + 4, t.w, t.h);
    const tg = ctx.createLinearGradient(0, a.y, 0, a.y + t.h);
    tg.addColorStop(0, '#6a4830'); tg.addColorStop(1, '#3a2010');
    ctx.fillStyle = tg; ctx.fillRect(a.x, a.y, t.w, t.h);
    ctx.fillStyle = '#a06a40'; ctx.fillRect(a.x, a.y, t.w, 2);
  }
  // Weapon display racks — futuristic illuminated cases
  for (const w of (C.UPPER_LOUNGE.WEAPON_RACKS || [])) {
    const a = worldToScreen(w.x, w.y);
    // backlit case
    ctx.fillStyle = '#0a0e16'; ctx.fillRect(a.x - 2, a.y - 18, w.w + 4, 32);
    const cg = ctx.createLinearGradient(0, a.y - 16, 0, a.y + 14);
    cg.addColorStop(0, '#1a2840'); cg.addColorStop(1, '#0a1018');
    ctx.fillStyle = cg; ctx.fillRect(a.x, a.y - 16, w.w, 28);
    // gun silhouette
    const wpn = C.WEAPONS[w.wpn];
    if (wpn) {
      ctx.fillStyle = wpn.color;
      ctx.shadowColor = wpn.color; ctx.shadowBlur = 10;
      ctx.fillRect(a.x + 12, a.y - 4, w.w - 24, 3);
      ctx.fillRect(a.x + 16, a.y - 8, 8, 4);
      ctx.shadowBlur = 0;
      // label
      ctx.fillStyle = wpn.color; ctx.font = '6px Courier New'; ctx.textAlign = 'center';
      ctx.fillText(wpn.name.toUpperCase(), a.x + w.w/2, a.y + 8);
    }
    // bottom light bar
    ctx.fillStyle = '#ffd060'; ctx.fillRect(a.x, a.y + 12, w.w, 1);
  }
  _drawWindows(C.UPPER_LOUNGE.WINDOWS);
  for (const n of C.UPPER_LOUNGE.NEON_SIGNS) _drawNeon(n);

  // PK zone
  _drawFloor(C.PK.floor, 'pk');
  for (const c of C.PK.covers) {
    const a = worldToScreen(c.x, c.y);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(a.x + 2, a.y + 4, c.w, c.h);
    const cg = ctx.createLinearGradient(0, a.y, 0, a.y + c.h);
    cg.addColorStop(0, '#403038'); cg.addColorStop(1, '#1a1218');
    ctx.fillStyle = cg; ctx.fillRect(a.x, a.y, c.w, c.h);
    ctx.fillStyle = '#5a4248'; ctx.fillRect(a.x, a.y, c.w, 1);
  }
  _drawNeon(C.PK.neon);

  // Vault zone
  _drawFloor(C.VAULT_ZONE.floor, 'vault');
  for (const c of C.VAULT_ZONE.covers) {
    const a = worldToScreen(c.x, c.y);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(a.x + 2, a.y + 4, c.w, c.h);
    const cg = ctx.createLinearGradient(0, a.y, 0, a.y + c.h);
    cg.addColorStop(0, '#403828'); cg.addColorStop(1, '#1a1408');
    ctx.fillStyle = cg; ctx.fillRect(a.x, a.y, c.w, c.h);
    ctx.fillStyle = '#5a4830'; ctx.fillRect(a.x, a.y, c.w, 1);
  }
  _drawNeon(C.VAULT_ZONE.neon);
  _drawVault();

  _drawWalls(walls);
  _drawSeats();

  // World-edge vignette
  const eg = ctx.createRadialGradient(canvas.width/2, canvas.height/2, Math.min(canvas.width, canvas.height) * 0.35, canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height) * 0.75);
  eg.addColorStop(0, 'rgba(0,0,0,0)');
  eg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = eg; ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Futuristic "Sparrers Up Next" LED queue board outside each spar
function _drawQueueBoard(r, key) {
  if (!r.queueBoard) return;
  const m = roomInfo.matches?.[key];
  const a = worldToScreen(r.queueBoard.x, r.queueBoard.y);
  const w = 200, h = 64;
  // panel back
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(a.x + 3, a.y + 4, w, h);
  const pg = ctx.createLinearGradient(0, a.y, 0, a.y + h);
  pg.addColorStop(0, '#0e1420'); pg.addColorStop(1, '#06080c');
  ctx.fillStyle = pg; ctx.fillRect(a.x, a.y, w, h);
  // glowing border
  ctx.strokeStyle = r.neon.color; ctx.lineWidth = 1;
  ctx.shadowColor = r.neon.color; ctx.shadowBlur = 8;
  ctx.strokeRect(a.x + 0.5, a.y + 0.5, w - 1, h - 1);
  ctx.shadowBlur = 0;
  // title bar
  ctx.fillStyle = r.neon.color + '22'; ctx.fillRect(a.x + 1, a.y + 1, w - 2, 14);
  ctx.fillStyle = r.neon.color;
  ctx.font = 'bold 8px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('▸ SPARRERS UP NEXT', a.x + w/2, a.y + 8);
  // content
  ctx.textAlign = 'left'; ctx.font = '8px Courier New';
  if (!m) {
    ctx.fillStyle = '#6a7488';
    ctx.fillText('— idle —', a.x + 8, a.y + 30);
  } else if (m.state === 'fighting') {
    ctx.fillStyle = '#ff6060';
    ctx.fillText('● LIVE', a.x + 8, a.y + 26);
    ctx.fillStyle = '#c0d0e0';
    const names = m.fighters.map(f => f.name).join(' vs ');
    const trunc = names.length > 26 ? names.slice(0, 24) + '…' : names;
    ctx.fillText(trunc, a.x + 8, a.y + 40);
    ctx.fillStyle = '#80a0c0';
    ctx.fillText(`queue: ${m.queue.length}`, a.x + 8, a.y + 54);
  } else {
    ctx.fillStyle = '#80c060';
    ctx.fillText('◯ OPEN', a.x + 8, a.y + 26);
    if (m.queue.length) {
      ctx.fillStyle = '#c0d0e0';
      const next = m.queue.slice(0, 2).map(q => q.name).join(', ');
      ctx.fillText('next: ' + next, a.x + 8, a.y + 40);
    } else {
      ctx.fillStyle = '#6a7488';
      ctx.fillText('queue empty', a.x + 8, a.y + 40);
    }
    if (m.championName) {
      ctx.fillStyle = '#ffe060';
      ctx.fillText('★ ' + m.championName + ' ×' + m.championStreak, a.x + 8, a.y + 54);
    }
  }
  // scanline animation
  const sy = a.y + ((Date.now() / 24) % h);
  ctx.fillStyle = r.neon.color + '14';
  ctx.fillRect(a.x, sy, w, 1);
}

function _drawVault() {
  const v = C.VAULT_ZONE.vault;
  const a = worldToScreen(v.x, v.y);
  const cx = a.x + v.w/2, cy = a.y + v.h/2;
  const hpPct = snapshot.vault.hp / snapshot.vault.maxHP;
  ctx.save();

  // floor glow pool
  const pool = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
  pool.addColorStop(0, 'rgba(255,220,80,0.30)');
  pool.addColorStop(0.6, 'rgba(255,180,60,0.10)');
  pool.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(cx - 120, cy - 120, 240, 240);

  // drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(a.x + 3, a.y + 6, v.w, v.h);

  // base plate — dark brass
  const baseG = ctx.createLinearGradient(0, a.y, 0, a.y + v.h);
  baseG.addColorStop(0, '#403020'); baseG.addColorStop(1, '#181008');
  ctx.fillStyle = baseG; ctx.fillRect(a.x, a.y, v.w, v.h);

  // outer rim
  ctx.strokeStyle = '#604830'; ctx.lineWidth = 3;
  ctx.strokeRect(a.x + 1.5, a.y + 1.5, v.w - 3, v.h - 3);

  // gold face panel with HP-driven brightness
  const gold = 80 + Math.floor(120 * hpPct);
  const goldG = ctx.createRadialGradient(cx, cy, 8, cx, cy, v.w/2);
  goldG.addColorStop(0, `rgb(${200+Math.floor(40*hpPct)},${160+Math.floor(60*hpPct)},${gold})`);
  goldG.addColorStop(0.7, `rgb(${160+Math.floor(40*hpPct)},${120+Math.floor(40*hpPct)},${gold-20})`);
  goldG.addColorStop(1, '#403018');
  ctx.fillStyle = goldG;
  ctx.fillRect(a.x + 10, a.y + 10, v.w - 20, v.h - 20);

  // glow around (intensifies as HP drops)
  ctx.shadowColor = hpPct > 0.5 ? '#ffd040' : (hpPct > 0.2 ? '#ff9040' : '#ff3030');
  ctx.shadowBlur = 12 + (1 - hpPct) * 32;
  ctx.strokeStyle = ctx.shadowColor; ctx.lineWidth = 2;
  ctx.strokeRect(a.x + 10, a.y + 10, v.w - 20, v.h - 20);
  ctx.shadowBlur = 0;

  // central dial
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#ffd040'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI*2); ctx.stroke();
  // inner spinner
  const spin = Date.now() / 600;
  ctx.strokeStyle = '#ffe080'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = spin + i * Math.PI/3;
    ctx.moveTo(cx + Math.cos(ang)*8, cy + Math.sin(ang)*8);
    ctx.lineTo(cx + Math.cos(ang)*16, cy + Math.sin(ang)*16);
  }
  ctx.stroke();
  // center dot
  ctx.fillStyle = '#ffe080'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fill();

  // bolts at corners
  ctx.fillStyle = '#1a1208';
  for (const [bx, by] of [[a.x+6,a.y+6],[a.x+v.w-6,a.y+6],[a.x+6,a.y+v.h-6],[a.x+v.w-6,a.y+v.h-6]]) {
    ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#5a4828';
    ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a1208';
  }

  // electric crack lines at low HP
  if (hpPct < 0.4) {
    ctx.strokeStyle = `rgba(255,${100+Math.floor(100*hpPct)},60,${0.6 + Math.sin(Date.now()/100)*0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x + 10, a.y + 30); ctx.lineTo(a.x + 30, a.y + 50); ctx.lineTo(a.x + 20, a.y + 70);
    ctx.moveTo(a.x + v.w - 10, a.y + 40); ctx.lineTo(a.x + v.w - 30, a.y + 60); ctx.lineTo(a.x + v.w - 15, a.y + 80);
    ctx.stroke();
  }

  // HP bar above (clean, recessed)
  const barX = a.x, barY = a.y - 14, barW = v.w, barH = 7;
  ctx.fillStyle = '#000'; ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  ctx.fillStyle = '#1a1208'; ctx.fillRect(barX, barY, barW, barH);
  const hpG = ctx.createLinearGradient(0, barY, 0, barY + barH);
  hpG.addColorStop(0, hpPct > 0.4 ? '#ffe080' : '#ff8040');
  hpG.addColorStop(1, hpPct > 0.4 ? '#ffa030' : '#c03030');
  ctx.fillStyle = hpG; ctx.fillRect(barX + 1, barY + 1, (barW - 2) * hpPct, barH - 2);
  ctx.fillStyle = '#ffe080'; ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
  ctx.fillText(Math.ceil(snapshot.vault.hp) + '/' + snapshot.vault.maxHP, cx, barY - 4);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function _drawSeats() {
  for (const s of (roomInfo.seats || [])) {
    const a = worldToScreen(s.x, s.y);
    if (s.kind === 'spec') {
      // theater chair — shadow + back + seat cushion
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(a.x - 9, a.y - 6, 18, 16);
      const bgrd = ctx.createLinearGradient(0, a.y - 10, 0, a.y + 10);
      bgrd.addColorStop(0, s.occupied ? '#5a4030' : '#2a1820'); bgrd.addColorStop(1, s.occupied ? '#2a1818' : '#100810');
      ctx.fillStyle = bgrd; ctx.fillRect(a.x - 8, a.y - 9, 16, 18);
      ctx.fillStyle = s.occupied ? '#7a5040' : '#3a2828'; ctx.fillRect(a.x - 8, a.y - 9, 16, 3);
      ctx.fillStyle = s.occupied ? '#9a6050' : '#4a3030'; ctx.fillRect(a.x - 7, a.y + 2, 14, 6);
    } else if (s.kind === 'lounge') {
      // lounge sofa chunk
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(a.x - 10, a.y - 6, 20, 18);
      const lg = ctx.createLinearGradient(0, a.y - 10, 0, a.y + 10);
      lg.addColorStop(0, s.occupied ? '#9a7040' : '#6a4828'); lg.addColorStop(1, s.occupied ? '#5a3018' : '#2a1808');
      ctx.fillStyle = lg; ctx.fillRect(a.x - 9, a.y - 9, 18, 20);
      ctx.fillStyle = s.occupied ? '#c08850' : '#806040'; ctx.fillRect(a.x - 9, a.y - 9, 18, 3);
    } else {
      // bar stool — circular cushion
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(a.x + 1, a.y + 2, 7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = s.occupied ? '#7a4030' : '#3a2020';
      ctx.beginPath(); ctx.arc(a.x, a.y, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = s.occupied ? '#a06040' : '#502828';
      ctx.beginPath(); ctx.arc(a.x - 1, a.y - 1, 3, 0, Math.PI*2); ctx.fill();
    }
  }
}

// ─── Players & equipped skins ──────────────────────────────
function _equippedColor(p, slot, fallback) {
  const id = p.equipped?.[slot];
  if (id && C.SHOP_ITEMS[id]) return C.SHOP_ITEMS[id].color;
  return fallback;
}

function _drawPlayer(p) {
  if (!p) return;
  const a = worldToScreen(p.x, p.y);
  if (a.x < -40 || a.y < -40 || a.x > canvas.width+40 || a.y > canvas.height+40) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(a.x, a.y + 13, 11, 4, 0, 0, Math.PI*2); ctx.fill();

  const bob = p.dancing ? Math.sin(Date.now()/180) * 2 : 0;

  // ── Cloak (rendered BEHIND body) ─────────────
  const cloakColor = _equippedColor(p, 'cloak', null);
  if (cloakColor) {
    const sway = Math.sin(Date.now()/300 + p.x*0.01) * 1.5;
    ctx.save();
    ctx.fillStyle = cloakColor;
    ctx.globalAlpha = 0.95;
    // shoulder strip
    ctx.fillRect(a.x - 12, a.y - 4 + bob, 24, 4);
    // flowing body
    ctx.beginPath();
    ctx.moveTo(a.x - 12, a.y - 2 + bob);
    ctx.lineTo(a.x - 14 + sway, a.y + 16 + bob);
    ctx.lineTo(a.x + 14 - sway, a.y + 16 + bob);
    ctx.lineTo(a.x + 12, a.y - 2 + bob);
    ctx.closePath();
    ctx.fill();
    // inner shadow line for fold
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.fillRect(a.x - 1, a.y + bob, 2, 14);
    ctx.restore();
  }

  ctx.fillStyle = _equippedColor(p, 'body', p.bodyColor);
  ctx.fillRect(a.x - 10, a.y - 2 + bob, 20, 16);
  ctx.fillStyle = p.accentColor; ctx.fillRect(a.x - 10, a.y + 3 + bob, 20, 2);

  ctx.fillStyle = _equippedColor(p, 'head', p.headColor);
  ctx.beginPath(); ctx.arc(a.x, a.y - 7 + bob, 8, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = p.hairColor; ctx.fillRect(a.x - 8, a.y - 14 + bob, 16, 4);
  if (p.equipped?.head === 'hat_vault') {
    ctx.fillStyle = '#ffd040';
    ctx.beginPath();
    ctx.moveTo(a.x - 10, a.y - 14 + bob);
    ctx.lineTo(a.x + 10, a.y - 14 + bob);
    ctx.lineTo(a.x + 6, a.y - 22 + bob);
    ctx.lineTo(a.x - 6, a.y - 22 + bob);
    ctx.closePath(); ctx.fill();
  }

  // Weapon — always shown anywhere
  const wd = C.WEAPONS[p.weapon] || C.WEAPONS.pistol;
  const wColor = _equippedColor(p, 'gunSkin', wd.color);
  ctx.save();
  ctx.translate(a.x, a.y + bob);
  ctx.rotate(p.angle);
  ctx.fillStyle = wColor;
  if (wd.type === 'melee') {
    ctx.fillRect(8, -1, 24, 3);
    ctx.fillStyle = '#3a3028'; ctx.fillRect(2, -2, 8, 4);
  } else {
    ctx.fillRect(8, -2, 14, 4);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(5, -3, 4, 6);
  }
  ctx.restore();

  ctx.fillStyle = p.id === myId ? '#ffe060' : '#c0c8d8';
  ctx.font = '8px Courier New'; ctx.textAlign = 'center';
  ctx.fillText(p.name, a.x, a.y - 24);
  if (p.squadName) {
    ctx.fillStyle = '#80c0ff'; ctx.font = '7px Courier New';
    ctx.fillText('◆ ' + p.squadName, a.x, a.y - 32);
  }

  const showHP = (Date.now() - p.lastHitTime) < C.HPBAR_VISIBLE_DURATION * 1000 || (p.role === 'fighter');
  if (showHP && p.alive) {
    ctx.fillStyle = '#000'; ctx.fillRect(a.x - 12, a.y + 16, 24, 3);
    ctx.fillStyle = p.hp / p.maxHP > 0.5 ? '#80c060' : (p.hp / p.maxHP > 0.25 ? '#d8a040' : '#d04040');
    ctx.fillRect(a.x - 11, a.y + 17, 22 * (p.hp / p.maxHP), 1);
  }

  if (p.chatBubble) {
    ctx.font = '8px Courier New'; ctx.textAlign = 'center';
    const w = ctx.measureText(p.chatBubble).width + 10;
    ctx.fillStyle = 'rgba(20,24,32,.92)';
    ctx.fillRect(a.x - w/2, a.y - 48, w, 14);
    ctx.fillStyle = '#d0d8e8';
    ctx.fillText(p.chatBubble, a.x, a.y - 38);
  }
  if (!p.alive) {
    ctx.fillStyle = 'rgba(120,20,20,0.4)';
    ctx.beginPath(); ctx.arc(a.x, a.y, 16, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function _drawVehicle(v) {
  const a = worldToScreen(v.x, v.y);
  const t = Date.now() / 100;
  let ang = 0;
  const rider = v.riderId ? snapshot.players.find(pp => pp.id === v.riderId) : null;
  if (rider) ang = rider.angle;
  ctx.save();
  // hover glow pool beneath (subtle, snow-bike doesn't fly — light skim)
  const pool = ctx.createRadialGradient(a.x, a.y + 16, 0, a.x, a.y + 16, 30);
  pool.addColorStop(0, 'rgba(120,180,255,0.25)');
  pool.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.fillStyle = pool; ctx.fillRect(a.x - 30, a.y + 4, 60, 30);
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(a.x, a.y + 18, 24, 5, 0, 0, Math.PI*2); ctx.fill();

  // Subtle hover sway
  const yh = Math.sin(t/12) * 0.8;
  ctx.translate(a.x, a.y + yh);
  ctx.rotate(ang);

  // ── SKI RUNNERS (front, two parallel) ──
  ctx.fillStyle = '#1a1e28';
  ctx.fillRect(14, -10, 16, 3);   // top ski runner
  ctx.fillRect(14, 7, 16, 3);     // bottom ski runner
  // ski upturn at front
  ctx.beginPath();
  ctx.moveTo(30, -10); ctx.lineTo(36, -12); ctx.lineTo(36, -7); ctx.lineTo(30, -7); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(30, 7); ctx.lineTo(36, 5); ctx.lineTo(36, 10); ctx.lineTo(30, 10); ctx.closePath(); ctx.fill();
  // ski highlight
  ctx.fillStyle = '#4a5468';
  ctx.fillRect(14, -10, 16, 1);
  ctx.fillRect(14, 7, 16, 1);

  // ── REAR TRACK (caterpillar tread block) ──
  const trackG = ctx.createLinearGradient(0, -10, 0, 10);
  trackG.addColorStop(0, '#3a3a4a');
  trackG.addColorStop(0.5, '#1a1a24');
  trackG.addColorStop(1, '#0a0a14');
  ctx.fillStyle = trackG;
  ctx.fillRect(-24, -9, 18, 18);
  // track grooves (animated when ridden)
  ctx.fillStyle = '#5a5a6a';
  const grooveOff = rider ? (t * 0.6) % 4 : 0;
  for (let gx = -23 + grooveOff; gx < -7; gx += 4) {
    ctx.fillRect(gx, -8, 1, 16);
  }

  // ── MAIN HULL (sleek elongated body) ──
  const hullG = ctx.createLinearGradient(0, -8, 0, 8);
  hullG.addColorStop(0, v.riderId ? '#9ac0f0' : '#5a6478');
  hullG.addColorStop(0.4, v.riderId ? '#4a78b0' : '#3a4458');
  hullG.addColorStop(1, '#1a2030');
  ctx.fillStyle = hullG;
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.lineTo(14, -8);
  ctx.lineTo(22, -3);
  ctx.lineTo(22, 3);
  ctx.lineTo(14, 8);
  ctx.lineTo(-12, 8);
  ctx.closePath();
  ctx.fill();
  // top spine highlight
  ctx.fillStyle = 'rgba(200,230,255,0.5)';
  ctx.fillRect(-12, -7, 28, 1);

  // ── WINDSHIELD (forward, curved) ──
  ctx.fillStyle = 'rgba(120,200,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(8, -5);
  ctx.lineTo(18, -2);
  ctx.lineTo(18, 2);
  ctx.lineTo(8, 5);
  ctx.closePath();
  ctx.fill();
  // glass tint highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, -4); ctx.lineTo(17, -2);
  ctx.stroke();

  // ── HANDLEBARS ──
  ctx.fillStyle = '#1a1e28';
  ctx.fillRect(2, -10, 2, 4);
  ctx.fillRect(2, 6, 2, 4);
  // grip caps
  ctx.fillStyle = rider ? (rider.accentColor || '#ff8040') : '#5a6478';
  ctx.fillRect(0, -11, 6, 2);
  ctx.fillRect(0, 9, 6, 2);

  // ── SEAT (where rider sits) ──
  ctx.fillStyle = '#1a1218';
  ctx.fillRect(-10, -5, 12, 10);
  ctx.fillStyle = '#2a1a20';
  ctx.fillRect(-10, -5, 12, 2);
  // stitching detail
  ctx.fillStyle = '#3a2828';
  ctx.fillRect(-10, 0, 12, 1);

  // ── EXHAUST PORTS (rear, with glow when ridden) ──
  ctx.fillStyle = v.riderId ? '#ff8040' : '#3a2820';
  if (rider) { ctx.shadowColor = '#ff8040'; ctx.shadowBlur = 10; }
  ctx.fillRect(-26, -5, 3, 3);
  ctx.fillRect(-26, 2, 3, 3);
  ctx.shadowBlur = 0;
  // exhaust trail when ridden
  if (rider) {
    const trail = Math.random() * 5 + 6;
    ctx.fillStyle = 'rgba(255,128,64,0.5)';
    ctx.beginPath();
    ctx.moveTo(-26, -4);
    ctx.lineTo(-26 - trail, -2);
    ctx.lineTo(-26 - trail, 4);
    ctx.lineTo(-26, 5);
    ctx.closePath();
    ctx.fill();
  }

  // ── HEADLIGHT (front) ──
  ctx.fillStyle = '#ffe080';
  if (rider) { ctx.shadowColor = '#ffe080'; ctx.shadowBlur = 8; }
  ctx.fillRect(20, -2, 3, 4);
  ctx.shadowBlur = 0;

  // ── ACCENT STRIPE (rider color) ──
  if (rider) {
    ctx.fillStyle = rider.accentColor || '#5aafff';
    ctx.fillRect(-10, 5, 24, 1);
  }

  ctx.restore();

  // Rider name above (or "press E")
  if (rider) {
    ctx.fillStyle = '#ffe060'; ctx.font = 'bold 7px Courier New'; ctx.textAlign = 'center';
    ctx.fillText('▲ ' + rider.name, a.x, a.y - 16);
  } else {
    ctx.fillStyle = '#80a0c0'; ctx.font = '7px Courier New'; ctx.textAlign = 'center';
    ctx.fillText('press E', a.x, a.y - 16);
  }
}

function _drawBullets() {
  for (const b of snapshot.bullets) {
    const a = worldToScreen(b.x, b.y);
    const w = C.WEAPONS[b.weapon];
    ctx.fillStyle = w?.color || '#fff';
    ctx.beginPath(); ctx.arc(a.x, a.y, C.BULLET_RADIUS, 0, Math.PI*2); ctx.fill();
  }
}
function _drawEffects(dt) {
  for (let i = effects.length-1; i >= 0; i--) {
    const e = effects[i]; e.t -= dt;
    if (e.t <= 0) { effects.splice(i,1); continue; }
    const a = worldToScreen(e.x, e.y);
    ctx.globalAlpha = Math.max(0, e.t / e.tMax);
    ctx.fillStyle = e.color || '#ff8040';
    ctx.beginPath(); ctx.arc(a.x, a.y, (e.r || 8) * (1 + (1-e.t/e.tMax)*0.6), 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function _drawSwings(dt) {
  for (let i = swings.length-1; i >= 0; i--) {
    const s = swings[i]; s.t -= dt;
    if (s.t <= 0) { swings.splice(i,1); continue; }
    const a = worldToScreen(s.x, s.y);
    ctx.save();
    ctx.globalAlpha = s.t / 0.18;
    ctx.strokeStyle = '#e0e0ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(a.x, a.y, s.range, s.angle - 0.9, s.angle + 0.9); ctx.stroke();
    ctx.restore();
  }
}
function _drawFloats(dt) {
  for (let i = floats.length-1; i >= 0; i--) {
    const f = floats[i]; f.t -= dt; f.y -= 30 * dt;
    if (f.t <= 0) { floats.splice(i,1); continue; }
    const a = worldToScreen(f.x, f.y);
    ctx.save();
    ctx.globalAlpha = f.t;
    ctx.fillStyle = f.color || '#fff'; ctx.font = 'bold 11px Courier New'; ctx.textAlign = 'center';
    ctx.fillText(f.text, a.x, a.y);
    ctx.restore();
  }
}
function _drawCursor() {
  if (!mouse.x && !mouse.y) return;
  ctx.strokeStyle = '#ffe06080'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(mouse.x-8, mouse.y); ctx.lineTo(mouse.x+8, mouse.y);
  ctx.moveTo(mouse.x, mouse.y-8); ctx.lineTo(mouse.x, mouse.y+8); ctx.stroke();
}

// ─── Event handlers ────────────────────────────────────────
function _onHit({targetId, damage, bx, by, weapon}) {
  effects.push({x:bx, y:by, t:0.3, tMax:0.3, r:8, color:'#ff8040'});
  floats.push({x:bx, y:by, t:1, text:'-'+damage, color: targetId === myId ? '#ff6060' : '#ffd040'});
}
function _onSwing({x, y, angle, range, ownerId}) {
  swings.push({x, y, angle, range, t:0.18});
}
function _onPkKill({killerName, victimName, vault}) {
  _pkFeed(`☠ ${killerName} killed ${victimName}`, vault);
}
function _pkFeed(text, vault) {
  const el = document.createElement('div'); el.className = 'pkf' + (vault ? ' vault' : ''); el.textContent = text;
  document.getElementById('pk-feed').appendChild(el);
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 500); }, 4000);
}
function _elog(text) {
  const el = document.createElement('div'); el.className = 'el'; el.textContent = '· ' + text;
  document.getElementById('elog').appendChild(el);
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 500); }, 4000);
}
function _miniChat(m) {
  if (m.fromId) return;
  const el = document.createElement('div'); el.className = 'mc';
  el.innerHTML = `<b style="color:${m.accentColor}">${m.name}</b>: ${m.text}`;
  const mc = document.getElementById('mini-chat'); mc.appendChild(el);
  while (mc.children.length > 4) mc.firstChild.remove();
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 500); }, 6000);
}

// ─── Chat ─────────────────────────────────────────────────
function _renderChat() {
  const el = document.getElementById('chat-log'); el.innerHTML = '';
  for (const m of chatLog) {
    const d = document.createElement('div'); d.className = 'chat-line';
    d.innerHTML = `<span class="cn" style="color:${m.accentColor||'#aab'}">${m.name}</span>: ${m.text}`;
    el.appendChild(d);
  }
  el.scrollTop = el.scrollHeight;
}
function toggleChat() { document.getElementById('chat-drawer').classList.toggle('open'); }
window.toggleChat = toggleChat;
function sendChat() {
  const i = document.getElementById('chat-inp'); const t = i.value.trim();
  if (t) socket.emit('chat', {text:t});
  i.value = '';
}
function sendQuickChat() {
  const i = document.getElementById('qc-input'); const t = i.value.trim();
  if (t) socket.emit('chat', {text:t});
  i.value = ''; document.getElementById('quick-chat').style.display = 'none';
}
window.sendChat = sendChat; window.sendQuickChat = sendQuickChat;

document.getElementById('chat-inp').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
document.getElementById('qc-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') sendQuickChat();
  else if (e.key === 'Escape') document.getElementById('quick-chat').style.display = 'none';
});

// ─── Guide panel ──────────────────────────────────────────
function toggleGuide() {
  const p = document.getElementById('guide-panel');
  p.style.display = p.style.display === 'block' ? 'none' : 'block';
  if (p.style.display === 'block') {
    const el = document.getElementById('guide-lines'); el.innerHTML = '';
    for (const line of C.GUIDE_LINES) {
      const d = document.createElement('div'); d.className = 'gp-line'; d.textContent = '› ' + line;
      el.appendChild(d);
    }
  }
}
window.toggleGuide = toggleGuide;

// ─── Profile ──────────────────────────────────────────────
let profileTargetId = null;
function openProfile(playerId) {
  profileTargetId = playerId;
  const p = snapshot.players.find(x => x.id === playerId); if (!p) return;
  document.getElementById('profile-panel').style.display = 'block';
  _refreshProfile(p);
  document.getElementById('pp-dm-btn').style.display = (playerId !== myId) ? 'block' : 'none';
  document.getElementById('pp-dm-btn').onclick = () => { toggleDM(); _openDmThread(playerId, p.name); };
  document.getElementById('pp-bio-edit').style.display = (playerId === myId) ? 'block' : 'none';
}
function closeProfile() { document.getElementById('profile-panel').style.display = 'none'; profileTargetId = null; }
window.closeProfile = closeProfile; window.openProfile = openProfile;

function _refreshProfile(p) {
  document.getElementById('pp-name').textContent = p.name;
  document.getElementById('pp-wins').textContent = p.wins;
  document.getElementById('pp-losses').textContent = p.losses;
  document.getElementById('pp-pkkills').textContent = p.pkKills;
  document.getElementById('pp-streak').textContent = p.streak;
  document.getElementById('pp-coins').textContent = p.coins;
  document.getElementById('pp-squad').textContent = p.squadName || '—';
  const m = Math.floor(p.onlineTime / 60), s = p.onlineTime % 60;
  document.getElementById('pp-online').textContent = `${m}m ${s}s`;
  document.getElementById('pp-bio').textContent = p.bio || '— no bio —';
  if (p.id === myId) document.getElementById('pp-bio-edit').value = p.bio || '';
  const c = document.getElementById('pp-canvas').getContext('2d');
  c.clearRect(0,0,48,58); c.save(); c.translate(24,32);
  c.fillStyle = _equippedColor(p, 'body', p.bodyColor); c.fillRect(-9,0,18,22);
  c.fillStyle = p.accentColor; c.fillRect(-9,5,18,2);
  c.fillStyle = _equippedColor(p, 'head', p.headColor); c.beginPath(); c.arc(0,-6,8,0,Math.PI*2); c.fill();
  c.fillStyle = p.hairColor; c.fillRect(-8,-13,16,4);
  c.restore();
}
function _refreshProfileIfMine(me) { if (profileTargetId === myId) _refreshProfile(me); }
document.getElementById('pp-bio-edit').addEventListener('blur', e => {
  socket.emit('updateBio', {bio: e.target.value});
});

// ─── DM ───────────────────────────────────────────────────
function toggleDM() {
  const p = document.getElementById('dm-panel');
  p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
  if (p.style.display === 'flex') {
    document.getElementById('dm-ico').classList.remove('alert');
    document.getElementById('m-dm')?.classList.remove('alert');
    _renderDmTabs();
  }
}
window.toggleDM = toggleDM;
function _openDmThread(otherId, otherName) {
  dmActiveTid = otherId;
  if (!dmThreads[otherId]) dmThreads[otherId] = {name:otherName, msgs:[], unread:false};
  dmThreads[otherId].unread = false;
  _renderDmTabs(); _renderDmThread();
}
function _renderDmTabs() {
  const el = document.getElementById('dm-tabs'); el.innerHTML = '';
  for (const tid in dmThreads) {
    const t = dmThreads[tid];
    const d = document.createElement('div'); d.className = 'dm-tab' + (tid === dmActiveTid ? ' active' : '');
    d.textContent = t.name; if (t.unread) d.innerHTML += '<span class="dmt-dot"></span>';
    d.onclick = () => { dmActiveTid = tid; t.unread = false; _renderDmTabs(); _renderDmThread(); };
    el.appendChild(d);
  }
}
function _renderDmThread() {
  const el = document.getElementById('dm-thread'); el.innerHTML = '';
  if (!dmActiveTid || !dmThreads[dmActiveTid]) { el.innerHTML = '<div class="dm-empty">Click a player to start a conversation.</div>'; return; }
  for (const m of dmThreads[dmActiveTid].msgs) {
    const d = document.createElement('div'); d.className = 'dm-msg ' + (m.fromId === myId ? 'mine' : 'theirs');
    d.textContent = m.text;
    el.appendChild(d);
  }
  el.scrollTop = el.scrollHeight;
}
function _onDM(m) {
  const otherId = m.fromId === myId ? m.toId : m.fromId;
  const otherName = m.fromId === myId ? m.toName : m.fromName;
  if (!dmThreads[otherId]) dmThreads[otherId] = {name:otherName, msgs:[], unread:false};
  dmThreads[otherId].msgs.push(m);
  const panelOpen = document.getElementById('dm-panel').style.display === 'flex';
  if (!panelOpen || dmActiveTid !== otherId) {
    if (m.fromId !== myId) {
      dmThreads[otherId].unread = true;
      document.getElementById('dm-ico').classList.add('alert');
      document.getElementById('m-dm')?.classList.add('alert');
    }
  }
  if (panelOpen) { _renderDmTabs(); if (dmActiveTid === otherId) _renderDmThread(); }
}
function sendDM() {
  if (!dmActiveTid) return;
  const i = document.getElementById('dm-input'); const t = i.value.trim();
  if (t) socket.emit('dm', {targetId:dmActiveTid, text:t});
  i.value = '';
}
window.sendDM = sendDM;
document.getElementById('dm-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendDM(); });

// ─── Shop ─────────────────────────────────────────────────
function toggleShop() {
  const p = document.getElementById('shop-panel');
  p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
  if (p.style.display === 'flex') _renderShop();
}
window.toggleShop = toggleShop;
function setShopTab(cat) {
  myShopCat = cat;
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
  _renderShop();
}
window.setShopTab = setShopTab;
function setShopSeason(tab) {
  myShopTab = tab;
  document.querySelectorAll('.shop-season').forEach(t => t.classList.toggle('active', t.dataset.season === tab));
  _renderShop();
}
window.setShopSeason = setShopSeason;
function _renderShop() {
  const me = snapshot.players.find(p => p.id === myId);
  document.getElementById('shop-coins').textContent = me?.coins || 0;
  const el = document.getElementById('shop-items'); el.innerHTML = '';
  for (const id in C.SHOP_ITEMS) {
    const it = C.SHOP_ITEMS[id]; if (it.type !== myShopCat) continue;
    if ((it.tab || 'classic') !== myShopTab) continue;
    const have = _ownedCache.includes(id);
    const equipped = me?.equipped?.[it.type] === id;
    const guest = isGuest;
    const item = document.createElement('div'); item.className = 'shop-item';
    const icon = it.type === 'gunSkin' ? '◆' : it.type === 'head' ? '◉' : it.type === 'cloak' ? '▽' : '⬢';
    item.innerHTML = `
      <div class="icon" style="background:${it.color}">${icon}</div>
      <div class="name">${it.name}</div>
      <div class="price">${it.unlockOnly ? 'UNLOCK' : it.price}</div>
      <button class="${equipped ? 'equipped' : (have ? 'owned' : '')}" ${guest || (it.unlockOnly && !have) ? 'disabled' : ''}>
        ${guest ? 'SIGN UP' : (equipped ? 'UNEQUIP' : (have ? 'EQUIP' : 'BUY'))}
      </button>`;
    item.querySelector('button').onclick = () => {
      if (guest) return;
      if (equipped) socket.emit('shopEquip', {slot:it.type, itemId:null});
      else if (have) socket.emit('shopEquip', {slot:it.type, itemId:id});
      else socket.emit('shopBuy', {itemId:id});
    };
    el.appendChild(item);
  }
}
function _onShopResult(d) {
  if (d.ok) {
    _ownedCache = d.owned;
    _renderShop();
    _elog(`Purchased ${C.SHOP_ITEMS[d.itemId]?.name || 'item'}!`);
  } else {
    alert(d.msg || 'Purchase failed');
  }
}

// ─── Trade table ──────────────────────────────────────────
function openTrade() {
  if (isGuest) { alert('sign up to use trade tables'); return; }
  const p = document.getElementById('trade-panel');
  if (!p) return;
  // populate recipient dropdown from online players (excluding self & bots)
  const sel = document.getElementById('trade-target');
  sel.innerHTML = '';
  const others = (roomInfo.online || []).filter(o => o.id !== myId);
  if (!others.length) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = '— no other players online —';
    sel.appendChild(opt);
  } else {
    for (const o of others) {
      const opt = document.createElement('option');
      opt.value = o.id; opt.textContent = o.name + (o.squadName ? ' ◆ ' + o.squadName : '');
      sel.appendChild(opt);
    }
  }
  document.getElementById('trade-result').textContent = '';
  p.style.display = 'flex';
}
function closeTrade() {
  const p = document.getElementById('trade-panel');
  if (p) p.style.display = 'none';
}
function doTrade() {
  const targetId = document.getElementById('trade-target').value;
  const amount = parseInt(document.getElementById('trade-amount').value, 10);
  if (!targetId) { document.getElementById('trade-result').textContent = 'pick a recipient'; return; }
  if (!amount || amount < 1) { document.getElementById('trade-result').textContent = 'invalid amount'; return; }
  socket.emit('giftCoins', {targetId, amount});
}
function _onTradeResult(d) {
  const el = document.getElementById('trade-result');
  if (el) {
    el.style.color = d.ok ? '#90c0a0' : '#e08060';
    el.textContent = d.msg || (d.ok ? 'sent' : 'failed');
  }
  _elog((d.ok ? '✓ ' : '✗ ') + (d.msg || ''));
}
window.openTrade = openTrade;
window.closeTrade = closeTrade;
window.doTrade = doTrade;

// ─── Squad ────────────────────────────────────────────────
function toggleSquad() {
  const p = document.getElementById('squad-panel');
  p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
  if (p.style.display === 'flex') {
    if (isGuest) {
      document.getElementById('squad-mine').innerHTML = '<div class="squad-section" style="font-size:9px;color:#8a90a0;text-align:center;padding:18px">Sign up to create or join a squad.</div>';
      document.getElementById('squad-list-wrap').innerHTML = '';
    } else socket.emit('squadList');
  }
}
window.toggleSquad = toggleSquad;
function _onSquadList({all, mySquad}) {
  mySquadCache = mySquad;
  const mine = document.getElementById('squad-mine');
  const list = document.getElementById('squad-list-wrap');
  if (mySquad) {
    const holdH = Math.floor(mySquad.vaultHoldSec / 3600);
    const holdM = Math.floor((mySquad.vaultHoldSec % 3600) / 60);
    mine.innerHTML = `
      <div class="squad-section">
        <div style="font-size:11px;color:#80c0ff;letter-spacing:.1em;margin-bottom:7px">◆ ${mySquad.name}</div>
        <div class="sq-row"><span>Members</span><span class="sq-val">${mySquad.members.length} / ${C.SQUAD.MAX_MEMBERS}</span></div>
        <div class="sq-row"><span>Vault Hold</span><span class="sq-val">${holdH}h ${holdM}m / 300h</span></div>
        <div class="sq-row"><span>Hat Unlocked</span><span class="sq-val">${mySquad.hatUnlocked ? 'YES ✦' : 'no'}</span></div>
        <div style="font-size:8px;color:#7a8090;margin:8px 0 4px">SQUAD ID: <span style="color:#a0c0e0;font-family:monospace">${mySquad.id}</span></div>
        <div class="sq-list">
          ${mySquad.members.map(m => `<div class="sq-member"><span>${m.name}</span><span class="${m.online?'online':'offline'}">${m.online?'● online':'○ offline'}</span></div>`).join('')}
        </div>
        <button style="margin-top:8px;width:100%;background:#2a1818;border:1px solid #6a2424;color:#e08080;font:8px 'Courier New';padding:6px;border-radius:2px;cursor:pointer" onclick="leaveSquad()">LEAVE SQUAD</button>
      </div>`;
    list.innerHTML = '';
  } else {
    mine.innerHTML = `
      <div class="squad-section">
        <div style="font-size:9px;color:#80b0d0;letter-spacing:.1em;margin-bottom:6px">CREATE SQUAD (200 ⌬)</div>
        <div class="sq-form">
          <input id="sq-name-input" type="text" maxlength="16" placeholder="Squad name…">
          <button onclick="createSquad()">CREATE</button>
        </div>
      </div>`;
    list.innerHTML = `
      <div class="squad-section">
        <div style="font-size:9px;color:#80b0d0;letter-spacing:.1em;margin-bottom:8px">ALL SQUADS</div>
        <div class="sq-list">
          ${all.length === 0 ? '<div style="font-size:8px;color:#5a6478;font-style:italic;padding:12px;text-align:center">No squads yet. Be the first.</div>' :
            all.map(s => `<div class="sq-item"><span>${s.name} (${s.memberCount}/10)${s.hatUnlocked?' ✦':''}</span><button onclick="joinSquad('${s.id}')">JOIN</button></div>`).join('')}
        </div>
      </div>`;
  }
}
function createSquad() {
  const i = document.getElementById('sq-name-input'); const n = i.value.trim();
  if (n) socket.emit('squadCreate', {name:n});
}
function joinSquad(id) { socket.emit('squadJoin', {squadId:id}); }
function leaveSquad() { if (confirm('Leave your squad?')) socket.emit('squadLeave'); }
window.createSquad = createSquad; window.joinSquad = joinSquad; window.leaveSquad = leaveSquad;
function _onSquadResult(d) {
  if (d.ok) socket.emit('squadList');
  else alert(d.msg || 'Squad action failed');
}

// ─── Job ──────────────────────────────────────────────────
function startJob() {
  document.getElementById('job-panel').style.display = 'flex';
  socket.emit('jobStart');
}
function closeJob() { document.getElementById('job-panel').style.display = 'none'; }
function endJob() { socket.emit('jobEnd'); closeJob(); }
function jobPour(color) { socket.emit('jobPour', {color}); }
window.startJob = startJob; window.closeJob = closeJob; window.endJob = endJob; window.jobPour = jobPour;
function _onJobResult(d) { if (!d.ok && d.msg) { alert(d.msg); closeJob(); } }
function _updateJobUI(me) {
  if (!me.onJob || !me.jobOrder) {
    const open = document.getElementById('job-panel').style.display === 'flex';
    if (open) closeJob();
    return;
  }
  document.getElementById('job-time').textContent = Math.ceil(me.jobOrder.timeLeft);
  document.getElementById('job-earned').textContent = me.jobOrder.coinsEarned || 0;
  const t = me.jobOrder.target, p = me.jobOrder.progress;
  const parts = [];
  for (const c of ['amber','blue','green','red']) {
    if ((t[c]||0) > 0) parts.push(`${p[c]||0}/${t[c]} ${c}`);
  }
  document.getElementById('job-order').textContent = 'Pour: ' + parts.join(', ');
}

// ─── Emote bar ────────────────────────────────────────────
function _buildEmoteBar() {
  const bar = document.getElementById('emote-bar'); bar.innerHTML = '';
  for (const e of C.EMOTES) {
    const b = document.createElement('div'); b.className = 'em-btn';
    b.textContent = e.text;
    b.onclick = () => { socket.emit('emote', {key:e.key}); bar.style.display = 'none'; };
    bar.appendChild(b);
  }
}
_buildEmoteBar();

// ─── Input ────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  KEY[e.key.toLowerCase()] = true;
  const k = e.key.toLowerCase();
  if (k === 'q') { e.preventDefault(); document.getElementById('quick-chat').style.display = 'flex'; document.getElementById('qc-input').focus(); }
  else if (k === 'y') { e.preventDefault(); const eb = document.getElementById('emote-bar'); eb.style.display = eb.style.display === 'flex' ? 'none' : 'flex'; }
  else if (k === 'r') inp.reload = true;
  else if (k === ' ') { e.preventDefault(); inp.dash = true; }
  else if (k === 'e') { e.preventDefault(); toggleMount(); }
  else if (k === 'f') { e.preventDefault(); tryInteractNPC(); }
  else if (k >= '1' && k <= '6') { const i = parseInt(k)-1; const w = C.WEAPON_ORDER[i]; if (w) inp.weapon = w; }
  else if (k === 'escape') {
    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    document.getElementById('chat-drawer').classList.remove('open');
    document.getElementById('emote-bar').style.display = 'none';
  }
});
window.addEventListener('keyup', e => {
  KEY[e.key.toLowerCase()] = false;
  if (e.key.toLowerCase() === 'r') inp.reload = false;
  if (e.key === ' ') inp.dash = false;
});

canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
canvas.addEventListener('mousedown', e => {
  mouse.down = true;
  const r = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  const w = screenToWorld(sx, sy);
  for (const p of snapshot.players) {
    if (Math.hypot(w.x - p.x, w.y - p.y) < 16 && p.id !== myId) { openProfile(p.id); return; }
  }
  for (const s of (roomInfo.seats || [])) {
    if (Math.hypot(w.x - s.x, w.y - s.y) < 14 && !s.occupied) { socket.emit('sitDown', {seatId:s.id}); return; }
  }
  for (const v of (snapshot.vehicles || [])) {
    if (Math.hypot(w.x - v.x, w.y - v.y) < 22 && !v.riderId) { socket.emit('mountVehicle', {vehicleId:v.id}); return; }
  }
});
canvas.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function toggleMount() {
  const me = snapshot.players.find(p => p.id === myId); if (!me) return;
  if (me.vehicleId) { socket.emit('dismountVehicle'); return; }
  let near = null, nd = 60;
  for (const v of snapshot.vehicles || []) {
    if (v.riderId) continue;
    const d = Math.hypot(v.x - me.x, v.y - me.y); if (d < nd) { nd = d; near = v; }
  }
  if (near) socket.emit('mountVehicle', {vehicleId:near.id});
  if (me.inSeat) socket.emit('standUp');
}
window.toggleMount = toggleMount;

// ─── Mobile input ────────────────────────────────────────
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
let mDir = {dx:0, dy:0}, mFire = {dx:0, dy:0, on:false};
function bindDpad(prefix, target) {
  const dirs = [['U',0,-1],['D',0,1],['L',-1,0],['R',1,0]];
  for (const [k,dx,dy] of dirs) {
    const el = document.getElementById(prefix+k);
    if (!el) continue;
    let active = false;
    const start = (e) => { e.preventDefault(); active = true; el.classList.add('act'); target.dx += dx; target.dy += dy; if (target.on !== undefined) target.on = true; };
    const stop  = (e) => { if (e) e.preventDefault(); if (!active) return; active = false; el.classList.remove('act'); target.dx -= dx; target.dy -= dy; if (target.on !== undefined) target.on = false; };
    el.addEventListener('touchstart', start, {passive:false});
    el.addEventListener('touchend', stop, {passive:false});
    el.addEventListener('touchcancel', stop);
  }
}
if (isMobile) {
  document.getElementById('mobile-controls').classList.add('show');
  document.getElementById('mobile-actions').classList.add('show');
  document.getElementById('mobile-comms').classList.add('show');
  bindDpad('dm', mDir);
  bindDpad('df', mFire);
  const fc = document.getElementById('dfC');
  fc.addEventListener('touchstart', e => { e.preventDefault(); mFire.on = true; fc.classList.add('act'); }, {passive:false});
  fc.addEventListener('touchend', e => { e.preventDefault(); mFire.on = false; fc.classList.remove('act'); }, {passive:false});
}
function mobileReload() { inp.reload = true; setTimeout(() => inp.reload = false, 120); }
function mobileDash() { inp.dash = true; setTimeout(() => inp.dash = false, 120); }
function cycleWeapon() {
  const me = snapshot.players.find(p => p.id === myId); if (!me) return;
  const i = C.WEAPON_ORDER.indexOf(me.weapon);
  inp.weapon = C.WEAPON_ORDER[(i+1) % C.WEAPON_ORDER.length];
}
window.mobileReload = mobileReload; window.mobileDash = mobileDash; window.cycleWeapon = cycleWeapon;

// ─── Send input ──────────────────────────────────────────
function _sendInput() {
  const me = snapshot.players.find(p => p.id === myId);
  if (!me) return;
  let dx = 0, dy = 0;
  if (isMobile) { dx = mDir.dx; dy = mDir.dy; }
  else {
    if (KEY['w'] || KEY['arrowup'])    dy -= 1;
    if (KEY['s'] || KEY['arrowdown'])  dy += 1;
    if (KEY['a'] || KEY['arrowleft'])  dx -= 1;
    if (KEY['d'] || KEY['arrowright']) dx += 1;
  }
  const ml = Math.hypot(dx, dy); if (ml > 1) { dx /= ml; dy /= ml; }
  let angle = 0;
  if (isMobile && (mFire.dx || mFire.dy)) angle = Math.atan2(mFire.dy, mFire.dx);
  else { const wx = mouse.x + cam.x, wy = mouse.y + cam.y; angle = Math.atan2(wy - me.y, wx - me.x); }
  let shoot = mouse.down || (isMobile && (mFire.on || mFire.dx || mFire.dy));
  inp.dx = dx; inp.dy = dy; inp.angle = angle; inp.shoot = shoot;
  const now = Date.now();
  if (now - lastInputT > 16) {
    socket.emit('input', inp);
    lastInputT = now;
    inp.weapon = null;
  }
}

// ─── Main loop ───────────────────────────────────────────
let lastT = Date.now();
function loop() {
  const now = Date.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  const me = snapshot.players.find(p => p.id === myId);

  if (!socket || !socket.connected || !myId || !me) { requestAnimationFrame(loop); return; }

  _sendInput();
  _updateCamera(me);

  const walls = _getWalls();
  _drawWorld(walls);

  for (const v of snapshot.vehicles || []) _drawVehicle(v);

  const sorted = [...snapshot.players].sort((a,b) => a.y - b.y);
  for (const p of sorted) _drawPlayer(p);

  _drawBullets();
  _drawSwings(dt);
  _drawEffects(dt);
  _drawFloats(dt);
  if (!isMobile) _drawCursor();

  requestAnimationFrame(loop);
}
loop();
