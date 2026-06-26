// client/game.js — VaultZone v6
'use strict';
const C = SHARED;
let socket = null;
let myId = null, myName = '—', isGuest = true, myEmail = null;
let snapshot = {players:[], bullets:[], vehicles:[], vault:{hp:2500,maxHP:2500,ownerSquadId:null}};
let _prevSnap = null, _curSnap = null;
const INTERP_DELAY_MS = 80; // render slightly behind for smoothness

function _interpolatedSnapshot() {
  if (!_curSnap || !_prevSnap) return snapshot;
  const renderT = performance.now() - INTERP_DELAY_MS;
  const dt = _curSnap._t - _prevSnap._t || 1;
  let alpha = (renderT - _prevSnap._t) / dt;
  if (alpha < 0) alpha = 0;
  if (alpha > 1) alpha = 1;
  const out = {
    bullets: _curSnap.bullets || [],
    vehicles: [],
    vault: _curSnap.vault,
    players: [],
  };
  // Players interp position + angle
  const prevById = new Map(_prevSnap.players.map(p => [p.id, p]));
  for (const cp of _curSnap.players) {
    const pp = prevById.get(cp.id);
    if (!pp) { out.players.push(cp); continue; }
    // Skip interp on my own player (use latest for snappy local response)
    if (cp.id === myId) { out.players.push(cp); continue; }
    const ip = {...cp};
    ip.x = pp.x + (cp.x - pp.x) * alpha;
    ip.y = pp.y + (cp.y - pp.y) * alpha;
    // Angle: handle wrap
    let da = cp.angle - pp.angle;
    while (da > Math.PI) da -= Math.PI*2;
    while (da < -Math.PI) da += Math.PI*2;
    ip.angle = pp.angle + da * alpha;
    out.players.push(ip);
  }
  // Vehicles interp
  const prevV = new Map((_prevSnap.vehicles || []).map(v => [v.id, v]));
  for (const cv of (_curSnap.vehicles || [])) {
    const pv = prevV.get(cv.id);
    if (!pv) { out.vehicles.push(cv); continue; }
    out.vehicles.push({...cv, x: pv.x + (cv.x - pv.x) * alpha, y: pv.y + (cv.y - pv.y) * alpha});
  }
  return out;
}
let roomInfo = {total:0, max:30, matches:{}, seats:[], online:[]};
let effects = []; let floats = []; let swings = [];
let chatLog = []; let dmThreads = {}; let dmActiveTid = null;
let cam = {x:0, y:0, tx:0, ty:0, scale:1.0, tScale:1.0, focus:false};
const KEY = {}; let mouse = {x:0, y:0, down:false};
let inp = {dx:0, dy:0, angle:0, shoot:false, reload:false, dash:false, weapon:null, jetpackToggle:false};
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
  socket.on('snapshot', s => {
    // Buffer previous + new for interpolation
    _prevSnap = _curSnap;
    _curSnap = {...s, _t: performance.now()};
    if (!_prevSnap) _prevSnap = _curSnap;
    snapshot = s; // raw current still available for stat/HUD code
    _updateHudFromSnap();
  });
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
  const zlabels = {lobby:'LOBBY', spar:'SPAR', pk:'PK ZONE', vault:'VAULT ZONE', upper:'SKY LOUNGE', trade:'TRADE ROOM'};
  document.getElementById('tb-zone').textContent = zlabels[me.zone] || me.zone.toUpperCase();

  // Jetpack fuel HUD
  const jpEl = document.getElementById('jetpack-fuel');
  const jpFill = document.getElementById('jp-fill');
  if (jpEl && jpFill) {
    const f = (me.jetpackFuel ?? 1.0);
    // Show only when fuel < 100% or when active (i.e., when meaningful)
    if (f < 0.999 || me.jetpackOn) {
      jpEl.style.display = 'flex';
      jpFill.style.width = (f * 100) + '%';
      jpFill.classList.toggle('low', f < 0.4 && !me.jetpackOn);
      jpFill.classList.toggle('empty', f < 0.05);
    } else jpEl.style.display = 'none';
  }
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
  // Mobile UX: hide action strip during spar fight (clutter-free)
  const ma = document.getElementById('mobile-actions');
  if (ma) ma.classList.toggle('spar-hide', me.role === 'fighter' && !!me.matchKey);
  const zp = document.getElementById('zone-prompt');
  let nearSpar = null;
  for (const k in C.SPAR_ROOMS) {
    const r = C.SPAR_ROOMS[k];
    const qm = r.queueMarker; if (!qm) continue;
    if (Math.hypot(me.x - qm.x, me.y - qm.y) < 60) { nearSpar = k; break; }
  }
  if (nearSpar && me.zone === 'lobby' && !me.matchKey) {
    const room = C.SPAR_ROOMS[nearSpar];
    zp.style.display = 'flex';
    const m = roomInfo.matches[nearSpar];
    const inQ = m?.queue.some(q => q.id === myId);
    document.getElementById('zp-label').textContent = (room.showdown ? '⚡ ' : '') + room.name.toUpperCase() + (room.showdown ? ' · 2000⌬' : ' SPAR');
    if (room.showdown) {
      document.getElementById('zp-sub').textContent = `${m?.fighters.length||0} fighting · ${m?.queue.length||0} queued · last alive wins`;
    } else {
      document.getElementById('zp-sub').textContent = `${m?.fighters.length||0} fighting · ${m?.queue.length||0} in queue`;
    }
    const btn = document.getElementById('zp-btn');
    btn.textContent = inQ ? 'LEAVE QUEUE (F)' : 'QUEUE UP (F)';
    btn.classList.toggle('inq', !!inQ);
    btn.dataset.spar = nearSpar; btn.dataset.inq = inQ ? '1' : '';
    const botBtn = document.getElementById('zp-bot-btn');
    botBtn.style.display = (nearSpar === 'twos' || room.showdown || m?.state !== 'idle' || inQ) ? 'none' : '';
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
  if (me.zone === 'trade') {
    // Any of the trade NPCs in the room
    const trs = C.TRADE_ROOM?.TRADE_NPCS || [];
    for (const t of trs) {
      if (Math.hypot(me.x - t.x, me.y - t.y) < 44) {
        np.style.display = 'flex';
        document.getElementById('npc-label').textContent = 'TRADE TABLE';
        document.getElementById('npc-sub').textContent = 'press F to open';
        const action = () => openTrade();
        document.getElementById('npc-btn').onclick = action;
        lastNpcType = {action};
        return;
      }
    }
    np.style.display = 'none'; lastNpcType = null; return;
  }
  if (me.zone !== 'lobby' && me.zone !== 'upper') { np.style.display = 'none'; lastNpcType = null; return; }
  const npcs = [
    {pos:C.LOBBY.GUIDE_NPC,   label:'GUIDE',         action:() => toggleGuide()},
    {pos:C.LOBBY.SHOP_NPC,    label:'SHOP',          action:() => toggleShop()},
    {pos:C.LOBBY.SQUAD_NPC,   label:'SQUAD',         action:() => toggleSquad()},
    {pos:C.LOBBY.JOB_NPC,     label:'BARTENDER JOB', action:() => startJob()},
    {pos:C.LOBBY.PROFILE_NPC, label:'YOUR PROFILE',  action:() => openProfile(myId)},
  ];
  let near = null;
  for (const n of npcs) { if (n.pos && Math.hypot(me.x - n.pos.x, me.y - n.pos.y) < 50) { near = n; break; } }
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
  let focusX, focusY, targetScale;
  // Determine focus + scale
  const sparKey = (me.role === 'fighter' && me.matchKey) ? me.matchKey
                : (me.seatKind === 'spec' && me.spectatingSpar) ? me.spectatingSpar
                : null;
  if (sparKey && C.SPAR_ROOMS[sparKey]) {
    const r = C.SPAR_ROOMS[sparKey];
    focusX = r.x + r.w/2;
    focusY = r.y + r.h/2;
    // Fit the room into the canvas with 12% padding around
    const padding = 0.88;
    const scaleX = (canvas.width * padding) / r.w;
    const scaleY = (canvas.height * padding) / r.h;
    targetScale = Math.min(scaleX, scaleY);
    // Clamp to reasonable range
    targetScale = Math.max(1.0, Math.min(targetScale, 2.6));
    cam.focus = true;
  } else {
    focusX = me.x;
    focusY = me.y;
    targetScale = 1.0;
    cam.focus = false;
  }
  // Target camera top-left so the focus point is centered
  const vw = canvas.width / targetScale;
  const vh = canvas.height / targetScale;
  cam.tx = focusX - vw / 2;
  cam.ty = focusY - vh / 2;
  cam.tScale = targetScale;
  // Smooth interp
  const lerp = cam.focus ? 0.10 : 0.18;
  cam.scale += (cam.tScale - cam.scale) * lerp;
  cam.x += (cam.tx - cam.x) * lerp;
  cam.y += (cam.ty - cam.y) * lerp;
  // Clamp camera so we don't show outside world
  const vw2 = canvas.width / cam.scale, vh2 = canvas.height / cam.scale;
  cam.x = Math.max(0, Math.min(Math.max(0, C.WORLD.W - vw2), cam.x));
  cam.y = Math.max(0, Math.min(Math.max(0, C.WORLD.H - vh2), cam.y));
}
function worldToScreen(x, y) { return {x:x - cam.x, y:y - cam.y}; }
function screenToWorld(x, y) { return {x:x / cam.scale + cam.x, y:y / cam.scale + cam.y}; }

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
    case 'lobby':   p = _makeTilePattern('#1a1a1a','#0a0a0a','#2a2a2a','#050505', 1); break;
    case 'spar':    p = _makeTilePattern('#161618','#080808','#2c2c30','#040404', 2); break;
    case 'pk':      p = _makeTilePattern('#1a0a0c','#080404','#3a1a1c','#040202', 3); break;
    case 'vault':   p = _makeTilePattern('#1c1c1c','#0a0a0a','#383838','#060606', 4); break;
    case 'upper':   p = _makeTilePattern('#1e1c1c','#0c0a0a','#2e2828','#0a0808', 5); break;
    case 'arena':   p = _makeTilePattern('#181818','#080808','#3a3a3a','#040404', 6); break;
    case 'trade':   p = _makeTilePattern('#1a0808','#080202','#3a0a0c','#040000', 7); break;
    default:        p = _makeTilePattern('#1a1a1a','#0a0a0a','#2a2a2a','#050505', 99);
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
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  for (const w of walls) {
    const a = worldToScreen(w.x, w.y);
    ctx.fillRect(a.x + 3, a.y + 5, w.w, w.h);
  }
  for (const w of walls) {
    const a = worldToScreen(w.x, w.y);
    const grd = ctx.createLinearGradient(0, a.y, 0, a.y + w.h);
    grd.addColorStop(0, '#2a2a2a');
    grd.addColorStop(0.5, '#181818');
    grd.addColorStop(1, '#080808');
    ctx.fillStyle = grd;
    ctx.fillRect(a.x, a.y, w.w, w.h);
    // brutalist top edge — sharp highlight
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(a.x, a.y, w.w, 1);
    // bottom dark edge
    ctx.fillStyle = '#000';
    ctx.fillRect(a.x, a.y + w.h - 1, w.w, 1);
    // occasional red rust streak (deterministic per wall)
    if ((w.x + w.y) % 137 === 0 && w.w > 30) {
      ctx.fillStyle = 'rgba(160,40,40,0.4)';
      ctx.fillRect(a.x + (w.w/3 | 0), a.y, 1, w.h);
    }
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
  for (const k in C.SPAR_ROOMS) addRoom(C.SPAR_ROOMS[k], []);
  addRoom(C.PK, [C.PK.entry, C.PK.entry2, C.PK.vaultEntry]);
  for (const c of C.PK.covers) walls.push({...c});
  addRoom(C.VAULT_ZONE, [C.VAULT_ZONE.entry]);
  for (const c of C.VAULT_ZONE.covers) walls.push({...c});
  addRoom(C.UPPER_LOUNGE, [C.UPPER_LOUNGE.ESCALATOR_OPENING]);
  const bc = C.LOBBY.BAR_COUNTER; walls.push({x:bc.x, y:bc.y, w:bc.w, h:6});
  for (const t of C.LOBBY.TABLES) walls.push({x:t.x, y:t.y, w:t.w, h:t.h});
  if (C.LOBBY.TRADE_TABLES) for (const t of C.LOBBY.TRADE_TABLES) walls.push({x:t.x, y:t.y, w:t.w, h:t.h});
  for (const t of C.UPPER_LOUNGE.TABLES) walls.push({x:t.x, y:t.y, w:t.w, h:t.h});
  const ub = C.UPPER_LOUNGE.BAR; walls.push({x:ub.x, y:ub.y, w:ub.w, h:6});
  if (C.TRADE_ROOM) {
    addRoom(C.TRADE_ROOM, [C.TRADE_ROOM.entry]);
    for (const t of C.TRADE_ROOM.TABLES || []) walls.push({x:t.x, y:t.y, w:t.w, h:t.h});
  }
  WALLS_CACHE = walls; return walls;
}

function _drawWorld(walls) {
  // (background cleared by loop before scale transform)

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
    // Queue marker pad — futuristic neon hex pad just outside the south wall
    if (r.queueMarker) {
      const qm = worldToScreen(r.queueMarker.x, r.queueMarker.y);
      const pulse = 0.65 + 0.35 * Math.sin(Date.now()/300);
      // floor glow pool
      const ppool = ctx.createRadialGradient(qm.x, qm.y, 0, qm.x, qm.y, 38);
      ppool.addColorStop(0, r.neon.color + (Math.floor(pulse*0xa0).toString(16).padStart(2,'0')));
      ppool.addColorStop(1, r.neon.color + '00');
      ctx.fillStyle = ppool;
      ctx.fillRect(qm.x - 40, qm.y - 40, 80, 80);
      // hex pad
      ctx.save();
      ctx.translate(qm.x, qm.y);
      ctx.strokeStyle = r.neon.color; ctx.lineWidth = 2;
      ctx.shadowColor = r.neon.color; ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI/3;
        const px = Math.cos(a) * 18, py = Math.sin(a) * 18;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      // inner symbol
      ctx.fillStyle = r.neon.color;
      ctx.font = 'bold 14px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('▲', 0, 0);
      ctx.restore();
      ctx.shadowBlur = 0;
    }
    // center arena medallion (concentric rings + faint room name)
    const cx = r.floor.x + r.floor.w/2, cy = r.floor.y + r.floor.h/2;
    const cs = worldToScreen(cx, cy);
    ctx.save();
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
    ctx.font = 'bold 26px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
  _drawNpc(lobby.GUIDE_NPC,   'GUIDE',     '#d8d8d8');
  _drawNpc(lobby.SHOP_NPC,    'SHOP',      '#e03a30');
  _drawNpc(lobby.SQUAD_NPC,   'SQUAD',     '#d8d8d8');
  _drawNpc(lobby.JOB_NPC,     'BARTENDER', '#d8d8d8');
  _drawNpc(lobby.PROFILE_NPC, 'PROFILE',   '#d8d8d8');

  // ── BRUTALIST CENTRAL MONOLITH (decentered, minimal) ──
  if (lobby.MONOLITH) {
    const m = lobby.MONOLITH;
    const ma = worldToScreen(m.x, m.y);
    const tt = Date.now() / 1000;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(ma.x + 4, ma.y + 8, m.w, m.h);
    // monolith body — vertical brushed concrete slab
    const mg = ctx.createLinearGradient(ma.x, 0, ma.x + m.w, 0);
    mg.addColorStop(0, '#1a1a1a'); mg.addColorStop(0.5, '#2c2c2c'); mg.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = mg;
    ctx.fillRect(ma.x, ma.y, m.w, m.h);
    // brushed vertical lines
    ctx.fillStyle = 'rgba(80,80,80,0.3)';
    for (let i = 4; i < m.w; i += 6) ctx.fillRect(ma.x + i, ma.y, 1, m.h);
    // red etched mark mid-slab
    ctx.fillStyle = '#e03a30';
    ctx.shadowColor = '#e03a30'; ctx.shadowBlur = 6;
    ctx.fillRect(ma.x + m.w/2 - 1, ma.y + 30, 2, m.h - 60);
    ctx.shadowBlur = 0;
    // top notch
    ctx.fillStyle = '#000';
    ctx.fillRect(ma.x + m.w/2 - 8, ma.y - 2, 16, 4);
    // base plinth
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(ma.x - 6, ma.y + m.h - 4, m.w + 12, 8);
    // ambient red floor wash beneath
    const wash = ctx.createRadialGradient(ma.x + m.w/2, ma.y + m.h + 8, 0, ma.x + m.w/2, ma.y + m.h + 8, 90);
    wash.addColorStop(0, 'rgba(224,58,48,0.18)');
    wash.addColorStop(1, 'rgba(224,58,48,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(ma.x - 80, ma.y + m.h - 30, m.w + 160, 100);

    // Plaza benches
    for (const bn of (lobby.PLAZA_BENCHES || [])) {
      const bna = worldToScreen(bn.x, bn.y);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bna.x + 2, bna.y + 4, bn.w, bn.h);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(bna.x, bna.y, bn.w, bn.h);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(bna.x, bna.y, bn.w, 1);
    }
  }

  // Brutalist pillars at the starting plaza (decor only)
  for (const p of (lobby.PILLARS || [])) {
    const pa = worldToScreen(p.x, p.y);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(pa.x + 3, pa.y + 5, p.w, p.h);
    // concrete column body
    const pg = ctx.createLinearGradient(pa.x, 0, pa.x + p.w, 0);
    pg.addColorStop(0, '#0a0a0a'); pg.addColorStop(0.5, '#2a2a2a'); pg.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = pg; ctx.fillRect(pa.x, pa.y, p.w, p.h);
    // top cap (steel)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(pa.x - 2, pa.y - 2, p.w + 4, 4);
    // brushed vertical lines
    ctx.fillStyle = 'rgba(70,70,70,0.4)';
    ctx.fillRect(pa.x + p.w/2 - 0.5, pa.y, 1, p.h);
    // red rust streak
    ctx.fillStyle = 'rgba(224,58,48,0.5)';
    ctx.fillRect(pa.x + 4, pa.y + p.h * 0.3, 1, p.h * 0.5);
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

  // Event Hall removed in v6.6 — see Showdown spar instead

  // Trade room — brutalist red-tinted
  if (C.TRADE_ROOM) {
    const tr = C.TRADE_ROOM;
    _drawFloor(tr.floor, 'trade');
    _drawNeon(tr.neon);
    // Tables
    for (const t of tr.TABLES) {
      const ta = worldToScreen(t.x, t.y);
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(ta.x + 3, ta.y + 5, t.w, t.h);
      const tg = ctx.createLinearGradient(0, ta.y, 0, ta.y + t.h);
      tg.addColorStop(0, '#2a0a0c'); tg.addColorStop(0.5, '#1a0608'); tg.addColorStop(1, '#0a0204');
      ctx.fillStyle = tg; ctx.fillRect(ta.x, ta.y, t.w, t.h);
      ctx.fillStyle = '#e03a30'; ctx.fillRect(ta.x, ta.y, t.w, 2);
      ctx.strokeStyle = 'rgba(224,58,48,0.4)'; ctx.lineWidth = 1;
      ctx.strokeRect(ta.x + 4, ta.y + 4, t.w - 8, t.h - 8);
    }
    // NPCs at each table
    for (const n of tr.TRADE_NPCS) _drawNpc(n, 'TRADE', '#e03a30');
    // Label above entry on lobby side
    const eL = worldToScreen(tr.x + tr.w/2, tr.y + tr.h + 18);
    ctx.fillStyle = '#e03a30'; ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center';
    ctx.shadowColor = '#e03a30'; ctx.shadowBlur = 6;
    ctx.fillText('▲ TRADE ROOM ▲', eL.x, eL.y);
    ctx.shadowBlur = 0;
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

  // PK zone — subway underground killzone
  _drawFloor(C.PK.floor, 'pk');
  // Subway track strips
  if (C.PK.TRACKS) {
    for (const t of C.PK.TRACKS) {
      const ta = worldToScreen(t.x, t.y);
      // dark concrete trench
      ctx.fillStyle = '#080a10';
      ctx.fillRect(ta.x, ta.y, t.w, t.h);
      // rail beams
      ctx.fillStyle = '#3a4458';
      ctx.fillRect(ta.x, ta.y + 4, t.w, 2);
      ctx.fillRect(ta.x, ta.y + 12, t.w, 2);
      // ties (cross beams)
      ctx.fillStyle = '#1a1e28';
      for (let tx = 0; tx < t.w; tx += 36) {
        ctx.fillRect(ta.x + tx, ta.y + 2, 8, 14);
      }
      // rail highlights
      ctx.fillStyle = '#5a6478';
      ctx.fillRect(ta.x, ta.y + 4, t.w, 1);
      ctx.fillRect(ta.x, ta.y + 12, t.w, 1);
    }
  }
  // Station signs
  if (C.PK.STATION_SIGNS) {
    for (const s of C.PK.STATION_SIGNS) {
      const sa = worldToScreen(s.x, s.y);
      ctx.fillStyle = 'rgba(10,12,18,0.92)';
      const tw = 180;
      ctx.fillRect(sa.x - tw/2, sa.y - 9, tw, 18);
      ctx.strokeStyle = '#ff2040'; ctx.lineWidth = 1;
      ctx.strokeRect(sa.x - tw/2 + 0.5, sa.y - 8.5, tw - 1, 17);
      ctx.fillStyle = '#ff8090'; ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff2040'; ctx.shadowBlur = 5;
      ctx.fillText(s.text, sa.x, sa.y);
      ctx.shadowBlur = 0;
    }
  }
  for (const c of C.PK.covers) {
    const a = worldToScreen(c.x, c.y);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(a.x + 2, a.y + 4, c.w, c.h);
    const cg = ctx.createLinearGradient(0, a.y, 0, a.y + c.h);
    // Subway-style: concrete columns + steel benches
    if (c.h > c.w * 1.8) {
      // pillar — concrete column
      cg.addColorStop(0, '#605860'); cg.addColorStop(0.5, '#403038'); cg.addColorStop(1, '#1a1218');
    } else if (c.h < 24) {
      // bench
      cg.addColorStop(0, '#3a3a48'); cg.addColorStop(1, '#1a1a24');
    } else {
      cg.addColorStop(0, '#403038'); cg.addColorStop(1, '#1a1218');
    }
    ctx.fillStyle = cg; ctx.fillRect(a.x, a.y, c.w, c.h);
    ctx.fillStyle = '#6a5258'; ctx.fillRect(a.x, a.y, c.w, 1);
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

  // Floor wash — soft red, intensifies as damaged
  const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, 140);
  const washA = 0.12 + (1 - hpPct) * 0.32;
  wash.addColorStop(0, `rgba(224,58,48,${washA})`);
  wash.addColorStop(1, 'rgba(224,58,48,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(cx - 140, cy - 140, 280, 280);

  // Heavy drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(a.x + 5, a.y + 8, v.w, v.h);

  // ── BRUTALIST CONCRETE BLOCK ──
  const baseG = ctx.createLinearGradient(a.x, 0, a.x + v.w, 0);
  baseG.addColorStop(0, '#1a1a1a'); baseG.addColorStop(0.5, '#2a2a2a'); baseG.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = baseG; ctx.fillRect(a.x, a.y, v.w, v.h);

  // Brushed vertical lines (concrete texture)
  ctx.fillStyle = 'rgba(70,70,70,0.4)';
  for (let i = 4; i < v.w; i += 5) ctx.fillRect(a.x + i, a.y, 1, v.h);

  // Sharp top highlight
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(a.x, a.y, v.w, 2);
  // Bottom dark edge
  ctx.fillStyle = '#000';
  ctx.fillRect(a.x, a.y + v.h - 2, v.w, 2);

  // Heavy outer frame (steel)
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 3;
  ctx.strokeRect(a.x + 1.5, a.y + 1.5, v.w - 3, v.h - 3);

  // ── INNER PANEL with red etched seal ──
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(a.x + 12, a.y + 12, v.w - 24, v.h - 24);

  // Red seal — single bold "X" mark, brand consistent
  const sealColor = hpPct > 0.5 ? '#e03a30' : (hpPct > 0.2 ? '#c03030' : '#801818');
  ctx.strokeStyle = sealColor; ctx.lineWidth = 4;
  ctx.shadowColor = sealColor; ctx.shadowBlur = 10 + (1 - hpPct) * 16;
  ctx.beginPath();
  ctx.moveTo(a.x + 22, a.y + 22); ctx.lineTo(a.x + v.w - 22, a.y + v.h - 22);
  ctx.moveTo(a.x + v.w - 22, a.y + 22); ctx.lineTo(a.x + 22, a.y + v.h - 22);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Bolts at corners — small steel rivets
  ctx.fillStyle = '#0a0a0a';
  for (const [bx, by] of [[a.x+7,a.y+7],[a.x+v.w-7,a.y+7],[a.x+7,a.y+v.h-7],[a.x+v.w-7,a.y+v.h-7]]) {
    ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath(); ctx.arc(bx, by, 2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0a0a0a';
  }

  // Damage cracks at low HP — sharp red fissures
  if (hpPct < 0.5) {
    ctx.strokeStyle = `rgba(224,58,48,${0.5 + (1 - hpPct) * 0.4 + Math.sin(Date.now()/120)*0.15})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x + 14, a.y + 18); ctx.lineTo(a.x + 22, a.y + 36); ctx.lineTo(a.x + 18, a.y + 56);
    ctx.moveTo(a.x + v.w - 14, a.y + 28); ctx.lineTo(a.x + v.w - 22, a.y + 48); ctx.lineTo(a.x + v.w - 16, a.y + 72);
    ctx.stroke();
  }

  // HP bar above — black/red brutalist
  const barX = a.x, barY = a.y - 16, barW = v.w, barH = 6;
  ctx.fillStyle = '#000'; ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = hpPct > 0.4 ? '#e03a30' : '#801818';
  ctx.fillRect(barX + 1, barY + 1, (barW - 2) * hpPct, barH - 2);
  ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
  ctx.fillText(Math.ceil(snapshot.vault.hp) + '/' + snapshot.vault.maxHP, cx, barY - 5);
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

  // Body — slight taper for shape
  ctx.fillStyle = _equippedColor(p, 'body', p.bodyColor);
  ctx.beginPath();
  ctx.moveTo(a.x - 9, a.y - 2 + bob);
  ctx.lineTo(a.x + 9, a.y - 2 + bob);
  ctx.lineTo(a.x + 10, a.y + 12 + bob);
  ctx.lineTo(a.x - 10, a.y + 12 + bob);
  ctx.closePath(); ctx.fill();

  // Jetpack — drawn between body and accent strip when equipped/charged
  if (p.jetpackFuel !== undefined && p.jetpackFuel < 1.0) {
    // backpack body — small dark box on upper-back
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(a.x - 7, a.y - 1 + bob, 14, 8);
    // steel housing
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(a.x - 7, a.y - 1 + bob, 14, 1);
    // twin thrust nozzles
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(a.x - 6, a.y + 7 + bob, 4, 4);
    ctx.fillRect(a.x + 2, a.y + 7 + bob, 4, 4);
    // fuel LED on backpack
    const fuelColor = p.jetpackOn ? '#e03a30' : (p.jetpackFuel > 0.5 ? '#80c080' : '#ffaa40');
    ctx.fillStyle = fuelColor;
    ctx.fillRect(a.x - 1, a.y + 1 + bob, 2, 2);
    // thrust flame when active
    if (p.jetpackOn) {
      const flick = 0.6 + Math.random() * 0.4;
      ctx.fillStyle = `rgba(255,140,40,${flick})`;
      ctx.shadowColor = '#ff6020'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(a.x - 5, a.y + 11 + bob);
      ctx.lineTo(a.x - 7, a.y + 16 + bob);
      ctx.lineTo(a.x - 4, a.y + 18 + bob);
      ctx.lineTo(a.x - 2, a.y + 16 + bob);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(a.x + 2, a.y + 11 + bob);
      ctx.lineTo(a.x + 4, a.y + 16 + bob);
      ctx.lineTo(a.x + 7, a.y + 18 + bob);
      ctx.lineTo(a.x + 5, a.y + 16 + bob);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      // bright core
      ctx.fillStyle = `rgba(255,240,200,${flick})`;
      ctx.fillRect(a.x - 5, a.y + 12 + bob, 3, 3);
      ctx.fillRect(a.x + 2, a.y + 12 + bob, 3, 3);
    }
  }

  // chest accent strip
  ctx.fillStyle = p.accentColor; ctx.fillRect(a.x - 9, a.y + 3 + bob, 18, 2);
  // shoulder highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(a.x - 9, a.y - 2 + bob, 18, 1);

  // Neck (subtle)
  ctx.fillStyle = _equippedColor(p, 'head', p.headColor);
  ctx.fillRect(a.x - 2, a.y - 4 + bob, 4, 3);

  // Head
  ctx.beginPath(); ctx.arc(a.x, a.y - 7 + bob, 7.5, 0, Math.PI*2); ctx.fill();
  // face shadow (jaw side)
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.arc(a.x + 1, a.y - 6 + bob, 7, 0, Math.PI*2); ctx.fill();

  // Sleek hair — flows back with subtle layers
  ctx.fillStyle = p.hairColor;
  // crown
  ctx.beginPath();
  ctx.ellipse(a.x, a.y - 12 + bob, 8, 4, 0, 0, Math.PI*2);
  ctx.fill();
  // side sweep
  ctx.beginPath();
  ctx.moveTo(a.x - 8, a.y - 12 + bob);
  ctx.lineTo(a.x - 7, a.y - 6 + bob);
  ctx.lineTo(a.x - 5, a.y - 9 + bob);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(a.x + 8, a.y - 12 + bob);
  ctx.lineTo(a.x + 7, a.y - 6 + bob);
  ctx.lineTo(a.x + 5, a.y - 9 + bob);
  ctx.closePath(); ctx.fill();
  // hair highlight strand
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(a.x - 4, a.y - 14 + bob, 1, 4);

  // Eye glint
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(a.x - 3, a.y - 7 + bob, 1.2, 1.2);
  ctx.fillRect(a.x + 2, a.y - 7 + bob, 1.2, 1.2);

  if (p.equipped?.head === 'hat_vault') {
    ctx.fillStyle = '#ffd040';
    ctx.beginPath();
    ctx.moveTo(a.x - 10, a.y - 14 + bob);
    ctx.lineTo(a.x + 10, a.y - 14 + bob);
    ctx.lineTo(a.x + 6, a.y - 22 + bob);
    ctx.lineTo(a.x - 6, a.y - 22 + bob);
    ctx.closePath(); ctx.fill();
  }

  // Weapon — drawn distinctively per type
  const wd = C.WEAPONS[p.weapon] || C.WEAPONS.pistol;
  const wColor = _equippedColor(p, 'gunSkin', wd.color);
  ctx.save();
  ctx.translate(a.x, a.y + bob);
  ctx.rotate(p.angle);
  if (p.weapon === 'pistol') {
    // compact sidearm
    ctx.fillStyle = '#181a20';
    ctx.fillRect(6, -2, 4, 6);          // grip
    ctx.fillStyle = wColor;
    ctx.fillRect(8, -2, 10, 3);         // slide
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(8, -2, 10, 0.5);       // highlight
  } else if (p.weapon === 'smg') {
    // stubby SMG with magazine
    ctx.fillStyle = '#1a1c22';
    ctx.fillRect(5, -2, 4, 7);          // grip
    ctx.fillStyle = wColor;
    ctx.fillRect(8, -3, 14, 3);         // body
    ctx.fillStyle = '#202428';
    ctx.fillRect(10, 0, 4, 5);          // magazine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(8, -3, 14, 0.5);
  } else if (p.weapon === 'shotgun') {
    // wide twin-barrel
    ctx.fillStyle = '#2a1a14';
    ctx.fillRect(2, -2, 6, 5);          // stock
    ctx.fillStyle = wColor;
    ctx.fillRect(8, -3, 18, 2);         // top barrel
    ctx.fillRect(8, 1, 18, 2);          // bottom barrel
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(8, -1, 18, 1);         // gap
  } else if (p.weapon === 'rifle') {
    // long precision rifle with scope
    ctx.fillStyle = '#181a20';
    ctx.fillRect(2, -2, 6, 5);          // stock
    ctx.fillStyle = wColor;
    ctx.fillRect(8, -1, 22, 2);         // long barrel
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(10, -4, 6, 2);         // scope
    ctx.fillStyle = '#80c0ff';
    ctx.fillRect(11, -3.5, 4, 0.5);     // scope lens
  } else if (p.weapon === 'blade') {
    // slim blade with hilt
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(2, -2, 6, 4);          // hilt
    ctx.fillStyle = '#5a4830';
    ctx.fillRect(7, -3, 2, 6);          // crossguard
    ctx.fillStyle = wColor;
    ctx.fillRect(9, -1, 22, 2);         // blade
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(9, -1, 22, 0.5);       // edge gleam
  } else if (p.weapon === 'katana') {
    // long curved blade
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(2, -2, 7, 4);          // wrapped hilt
    ctx.fillStyle = '#e03a30';
    ctx.fillRect(2, -1.5, 7, 0.5);
    ctx.fillRect(2, 1, 7, 0.5);
    ctx.fillStyle = '#2a0810';
    ctx.fillRect(8, -3, 2, 6);          // tsuba
    ctx.fillStyle = wColor;
    ctx.fillRect(10, -1, 26, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(10, -1, 26, 0.5);
  } else if (p.weapon === 'laser') {
    // Laser rifle — slim, red emitter, twin prongs
    ctx.fillStyle = '#181818';
    ctx.fillRect(2, -2, 6, 5);          // grip
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(8, -2, 18, 4);         // body
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(8, -1, 18, 0.5);
    ctx.fillRect(8, 2, 18, 0.5);
    // emitter prongs
    ctx.fillStyle = '#e03a30';
    ctx.shadowColor = '#e03a30'; ctx.shadowBlur = 6;
    ctx.fillRect(26, -2, 2, 1);
    ctx.fillRect(26, 1, 2, 1);
    ctx.shadowBlur = 0;
  } else if (p.weapon === 'rodgun') {
    // Rod gun — heavy boxy launcher
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, -3, 6, 7);          // shoulder stock
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(6, -4, 16, 8);         // bulky body
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(6, -4, 16, 1);
    ctx.fillRect(6, 3, 16, 1);
    // barrel
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(22, -2, 8, 4);
    // exposed rod tip
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(30, -1, 4, 2);
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
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(a.x, a.y + 22, 24, 6, 0, 0, Math.PI*2); ctx.fill();

  ctx.translate(a.x, a.y);
  ctx.rotate(ang);

  // ── TWIN SKI RUNNERS (wider, longer, prominent up front) ──
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(8, -14, 22, 5);     // upper ski
  ctx.fillRect(8, 9, 22, 5);       // lower ski
  // ski tips curving up
  ctx.beginPath();
  ctx.moveTo(30, -14); ctx.lineTo(38, -16); ctx.lineTo(38, -9); ctx.lineTo(30, -9); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(30, 9); ctx.lineTo(38, 7); ctx.lineTo(38, 14); ctx.lineTo(30, 14); ctx.closePath(); ctx.fill();
  // ski underside dark
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(8, -14, 22, 1);
  ctx.fillRect(8, 13, 22, 1);
  // ski highlights
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(10, -12, 18, 1);
  ctx.fillRect(10, 11, 18, 1);

  // ── REAR TRACK (boxy caterpillar tread) ──
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-26, -11, 20, 22);
  const tg = ctx.createLinearGradient(-26, -11, -6, 11);
  tg.addColorStop(0, '#3a3a3a'); tg.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = tg;
  ctx.fillRect(-25, -10, 18, 20);
  // tread grooves
  ctx.fillStyle = '#1a1a1a';
  const grooveOff = rider ? (t * 0.8) % 4 : 0;
  for (let gx = -24 + grooveOff; gx < -7; gx += 3) {
    ctx.fillRect(gx, -10, 1, 20);
  }
  // suspension nubs
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(-25, -2, 18, 1);

  // ── MAIN HULL — matte steel, BOXY (not aerodynamic) ──
  // lower hull (engine cowl)
  const hullG = ctx.createLinearGradient(0, -7, 0, 9);
  hullG.addColorStop(0, '#7a7a7a');
  hullG.addColorStop(0.4, '#4a4a4a');
  hullG.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = hullG;
  ctx.fillRect(-8, -9, 22, 18);
  // matte top with brushed steel lines
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(-8, -9, 22, 1);
  ctx.fillStyle = 'rgba(120,120,120,0.5)';
  ctx.fillRect(-8, -6, 22, 0.5);
  ctx.fillRect(-8, -3, 22, 0.5);
  ctx.fillRect(-8, 0, 22, 0.5);
  ctx.fillRect(-8, 3, 22, 0.5);
  ctx.fillStyle = '#000';
  ctx.fillRect(-8, 8, 22, 1);

  // ── TALL SEAT (vertical bench, snowmobile style) ──
  ctx.fillStyle = '#000';
  ctx.fillRect(-6, -5, 8, 10);     // seat shadow
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-5, -5, 7, 10);     // seat body
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(-5, -5, 7, 1);      // top edge
  // seat stitching
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-5, 0, 7, 0.5);

  // ── HANDLEBARS (wider, snowmobile-style cross bar) ──
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(8, -10, 2, 4);
  ctx.fillRect(8, 6, 2, 4);
  // grips
  ctx.fillStyle = rider ? '#e03a30' : '#3a3a3a';
  ctx.fillRect(6, -12, 6, 2);
  ctx.fillRect(6, 10, 6, 2);

  // ── DASHBOARD (between handlebars) ──
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(10, -3, 4, 6);
  ctx.fillStyle = rider ? '#e03a30' : '#1a1a1a';
  ctx.fillRect(11, -2, 2, 1);     // speedo
  ctx.fillRect(11, 1, 2, 1);      // gear

  // ── HEADLIGHT (squared, recessed) ──
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(14, -3, 6, 6);
  ctx.fillStyle = rider ? '#e0e0e0' : '#5a5a5a';
  if (rider) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 6; }
  ctx.fillRect(15, -2, 4, 4);
  ctx.shadowBlur = 0;

  // ── EXHAUST PORT (rear) ──
  ctx.fillStyle = rider ? '#e03a30' : '#2a1a1a';
  if (rider) { ctx.shadowColor = '#e03a30'; ctx.shadowBlur = 8; }
  ctx.fillRect(-28, -3, 2, 6);
  ctx.shadowBlur = 0;
  if (rider) {
    // exhaust smoke trail
    const trail = Math.random() * 4 + 5;
    ctx.fillStyle = 'rgba(100,100,100,0.4)';
    ctx.beginPath();
    ctx.moveTo(-28, -3);
    ctx.lineTo(-28 - trail, -1);
    ctx.lineTo(-28 - trail, 3);
    ctx.lineTo(-28, 3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  if (rider) {
    ctx.fillStyle = '#e0e0e0'; ctx.font = 'bold 7px Courier New'; ctx.textAlign = 'center';
    ctx.fillText('▲ ' + rider.name, a.x, a.y - 22);
  } else {
    ctx.fillStyle = '#a0a0a0'; ctx.font = '7px Courier New'; ctx.textAlign = 'center';
    ctx.fillText('press E', a.x, a.y - 22);
  }
}

function _drawBullets() {
  for (const b of snapshot.bullets) {
    const a = worldToScreen(b.x, b.y);
    const w = C.WEAPONS[b.weapon];
    const color = w?.color || '#e0e0e0';
    const style = w?.bulletStyle || 'standard';
    const ang = Math.atan2(b.vy || 0, b.vx || 1);
    ctx.save();
    if (style === 'beam') {
      // Laser — long thin red beam with bright core + glow
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);
      ctx.shadowColor = '#ff4040'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff4040'; ctx.fillRect(-14, -1, 28, 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.fillRect(-14, -0.5, 28, 1);
    } else if (style === 'rod') {
      // Rod gun — long metal rod
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-12, -2, 24, 4); // outline
      const g = ctx.createLinearGradient(0, -2, 0, 2);
      g.addColorStop(0, '#c8c8c8'); g.addColorStop(0.5, '#888'); g.addColorStop(1, '#3a3a3a');
      ctx.fillStyle = g; ctx.fillRect(-11, -1.5, 22, 3);
      ctx.fillStyle = '#e0e0e0'; ctx.fillRect(-11, -1.5, 22, 0.5);
    } else if (style === 'sharp') {
      // Rifle — sharp pointed bullet with trail
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(208,208,208,0.4)';
      ctx.fillRect(-10, -0.5, 6, 1);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-4, -1.5); ctx.lineTo(3, 0); ctx.lineTo(-4, 1.5);
      ctx.closePath(); ctx.fill();
    } else if (style === 'tracer') {
      // SMG — small with subtle trail
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(184,184,184,0.35)';
      ctx.fillRect(-6, -0.5, 4, 1);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI*2); ctx.fill();
    } else if (style === 'pellet') {
      // Shotgun — small dark pellet
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(a.x, a.y, 2, 0, Math.PI*2); ctx.fill();
    } else {
      // standard — pistol round
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(a.x, a.y, C.BULLET_RADIUS + 0.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(a.x, a.y, C.BULLET_RADIUS - 0.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
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
function _amInSparFight() {
  const me = snapshot.players.find(p => p.id === myId);
  return me && me.role === 'fighter' && me.matchKey;
}
function sendChat() {
  if (_amInSparFight()) { _elog('chat disabled in spar'); return; }
  const i = document.getElementById('chat-inp'); const t = i.value.trim();
  if (t) socket.emit('chat', {text:t});
  i.value = '';
}
function sendQuickChat() {
  if (_amInSparFight()) { _elog('chat disabled in spar'); return; }
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
  if (_amInSparFight()) return;
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
  else if (k === 'j') { e.preventDefault(); inp.jetpackToggle = true; }
  else if (k >= '1' && k <= '8') { const i = parseInt(k)-1; const w = C.WEAPON_ORDER[i]; if (w) inp.weapon = w; }
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
  if (_amInSparFight()) return;
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
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
let mDir = {dx:0, dy:0}, mFire = {dx:0, dy:0, on:false};

function bindAnalogStick(ringId, thumbId, target, isFire) {
  const ring = document.getElementById(ringId);
  const thumb = document.getElementById(thumbId);
  if (!ring) return;
  const max = 40;
  let touchId = null;
  const reset = () => {
    target.dx = 0; target.dy = 0;
    if (isFire) target.on = false;
    thumb.style.left = '29px'; thumb.style.top = '29px';
  };
  ring.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (touchId !== null) return;
    const t = e.changedTouches[0];
    touchId = t.identifier;
    const r = ring.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const m = Math.hypot(dx, dy);
    if (m > max) { dx = dx * max / m; dy = dy * max / m; }
    const nm = Math.hypot(dx, dy);
    target.dx = nm < 6 ? 0 : dx / max;
    target.dy = nm < 6 ? 0 : dy / max;
    if (isFire) target.on = true;
    thumb.style.left = (29 + dx) + 'px';
    thumb.style.top = (29 + dy) + 'px';
  }, {passive:false});
  ring.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== touchId) continue;
      const r = ring.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const m = Math.hypot(dx, dy);
      if (m > max) { dx = dx * max / m; dy = dy * max / m; }
      const nm = Math.hypot(dx, dy);
      target.dx = nm < 6 ? 0 : dx / max;
      target.dy = nm < 6 ? 0 : dy / max;
      thumb.style.left = (29 + dx) + 'px';
      thumb.style.top = (29 + dy) + 'px';
      break;
    }
  }, {passive:false});
  const end = (e) => {
    if (e) e.preventDefault();
    for (const t of (e?.changedTouches || [])) {
      if (t.identifier === touchId) { touchId = null; reset(); return; }
    }
    touchId = null; reset();
  };
  ring.addEventListener('touchend', end, {passive:false});
  ring.addEventListener('touchcancel', end);
}

if (isMobile) {
  document.getElementById('mobile-controls').classList.add('show');
  document.getElementById('mobile-actions').classList.add('show');
  bindAnalogStick('dpad-move', 'dpad-move-thumb', mDir, false);
  bindAnalogStick('dpad-fire', 'dpad-fire-thumb', mFire, true);
}

function toggleMobileMenu() {
  document.getElementById('mobile-menu-panel').classList.toggle('open');
}
function closeMobileMenu() {
  document.getElementById('mobile-menu-panel').classList.remove('open');
}
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
function mobileReload() { inp.reload = true; setTimeout(() => inp.reload = false, 120); }
function mobileDash() { inp.dash = true; setTimeout(() => inp.dash = false, 120); }
function cycleWeapon() {
  const me = snapshot.players.find(p => p.id === myId); if (!me) return;
  const i = C.WEAPON_ORDER.indexOf(me.weapon);
  inp.weapon = C.WEAPON_ORDER[(i+1) % C.WEAPON_ORDER.length];
}
window.mobileReload = mobileReload; window.mobileDash = mobileDash; window.cycleWeapon = cycleWeapon;
function mobileJetpack() { inp.jetpackToggle = true; }
window.mobileJetpack = mobileJetpack;

// ─── Settings panel ───────────────────────────────────────
let MOUSE_SENSITIVITY = parseFloat(localStorage.getItem('vz_sens') || '1.0');
function toggleSettingsPanel() {
  const p = document.getElementById('settings-panel');
  p.style.display = p.style.display === 'block' ? 'none' : 'block';
  if (p.style.display === 'block') {
    const slider = document.getElementById('sens-slider');
    slider.value = MOUSE_SENSITIVITY;
    document.getElementById('sens-val').textContent = MOUSE_SENSITIVITY.toFixed(2);
    slider.oninput = (e) => {
      MOUSE_SENSITIVITY = parseFloat(e.target.value);
      document.getElementById('sens-val').textContent = MOUSE_SENSITIVITY.toFixed(2);
      localStorage.setItem('vz_sens', MOUSE_SENSITIVITY);
    };
  }
}
window.toggleSettingsPanel = toggleSettingsPanel;

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
  else {
    // Apply sensitivity: amplify the cursor's offset from screen center before converting to world
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const sx = cx + (mouse.x - cx) * MOUSE_SENSITIVITY;
    const sy = cy + (mouse.y - cy) * MOUSE_SENSITIVITY;
    const w = screenToWorld(sx, sy);
    angle = Math.atan2(w.y - me.y, w.x - me.x);
  }
  let shoot = mouse.down || (isMobile && (mFire.on || mFire.dx || mFire.dy));
  inp.dx = dx; inp.dy = dy; inp.angle = angle; inp.shoot = shoot;
  const now = Date.now();
  if (now - lastInputT > 16) {
    socket.emit('input', inp);
    lastInputT = now;
    inp.weapon = null;
    inp.jetpackToggle = false;
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

  // Clear background first (unscaled)
  ctx.fillStyle = '#06080d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Build interpolated draw snapshot
  const drawSnap = _interpolatedSnapshot();
  const walls = _getWalls();

  // Apply world-scale transform — spar zoom-in for fighters/spectators
  ctx.save();
  ctx.scale(cam.scale, cam.scale);

  _drawWorld(walls);
  for (const v of drawSnap.vehicles || []) _drawVehicle(v);
  const sorted = [...drawSnap.players].sort((a,b) => a.y - b.y);
  for (const p of sorted) _drawPlayer(p);
  _drawBullets();
  _drawSwings(dt);
  _drawEffects(dt);
  _drawFloats(dt);

  ctx.restore();

  // Cursor stays in screen space (no scale)
  if (!isMobile) _drawCursor();

  requestAnimationFrame(loop);
}
loop();
