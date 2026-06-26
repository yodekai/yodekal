// shared/constants.js — v6.2 (structural redesign)
'use strict';

const SHARED = {
  TICK_RATE: 60,
  MAX_PLAYERS: 30,
  WORLD: { W: 3300, H: 3400 },
  CAMERA: { W: 800, H: 600 },

  // ── SPAR COMPLEX (4 corner rooms, with spec seats outside each) ──
  // Top-left, top-right, mid-left, mid-right. All entries face SOUTH into lobby.
  SPAR_ROOMS: {
    classic: {
      name:'Classic', label:'1v1',
      x:160, y:140, w:480, h:380,
      floor:{x:188,y:168,w:424,h:322},
      spawn:[{x:280,y:320},{x:540,y:320}],
      maxHP:120,
      entry:{x:380,y:520,w:60,h:78},
      neon:{x:400,y:158,text:'CLASSIC',color:'#40d0ff',size:14},
      specSeats:[{x:280,y:660},{x:340,y:660},{x:400,y:660},{x:460,y:660},{x:520,y:660}],
      queueBoard:{x:300,y:640},
    },
    iron: {
      name:'Iron', label:'1v1 · 200HP',
      x:2660, y:140, w:480, h:380,
      floor:{x:2688,y:168,w:424,h:322},
      spawn:[{x:2780,y:320},{x:3040,y:320}],
      maxHP:200,
      entry:{x:2880,y:520,w:60,h:78},
      neon:{x:2900,y:158,text:'IRON',color:'#ff8040',size:14},
      specSeats:[{x:2780,y:660},{x:2840,y:660},{x:2900,y:660},{x:2960,y:660},{x:3020,y:660}],
      queueBoard:{x:2800,y:640},
    },
    blitz: {
      name:'Blitz', label:'1v1 · 80HP fast',
      x:160, y:1340, w:420, h:340,
      floor:{x:188,y:1368,w:364,h:284},
      spawn:[{x:260,y:1490},{x:480,y:1490}],
      maxHP:80,
      entry:{x:350,y:1680,w:60,h:78},
      neon:{x:370,y:1358,text:'BLITZ',color:'#ff4060',size:14},
      specSeats:[{x:250,y:1820},{x:310,y:1820},{x:370,y:1820},{x:430,y:1820},{x:490,y:1820}],
      queueBoard:{x:270,y:1800},
    },
    twos: {
      name:'2v2', label:'2 vs 2',
      x:2720, y:1340, w:520, h:380,
      floor:{x:2748,y:1368,w:464,h:322},
      spawn:[{x:2810,y:1480},{x:2810,y:1580},{x:3150,y:1480},{x:3150,y:1580}],
      maxHP:120,
      entry:{x:2950,y:1720,w:60,h:78},
      neon:{x:2980,y:1358,text:'2v2',color:'#ff40c0',size:14},
      specSeats:[{x:2840,y:1860},{x:2900,y:1860},{x:2960,y:1860},{x:3020,y:1860},{x:3080,y:1860}],
      queueBoard:{x:2860,y:1840},
    },
    melee: {
      name:'Melee', label:'Blade only',
      x:1480, y:140, w:460, h:380,
      floor:{x:1508,y:168,w:404,h:322},
      spawn:[{x:1580,y:320},{x:1840,y:320}],
      maxHP:100,
      entry:{x:1680,y:520,w:60,h:78},
      neon:{x:1710,y:158,text:'⚔ MELEE',color:'#e0e0ff',size:14},
      specSeats:[{x:1580,y:660},{x:1640,y:660},{x:1700,y:660},{x:1760,y:660},{x:1820,y:660}],
      queueBoard:{x:1600,y:640},
      meleeOnly:true,
    },
  },

  // ── MAIN LOBBY ────────────────────────────────────────────────
  // Big central hub. Bar north, spawn middle, escalator east → upper lounge.
  LOBBY: {
    x:80, y:740, w:3140, h:1180,
    SPAWN_AREA: { x:1480, y:1180, w:340, h:340 },
    GUIDE_NPC:  { x:300,  y:1100 },
    SHOP_NPC:   { x:1080, y:880 },
    SQUAD_NPC:  { x:1320, y:880 },
    JOB_NPC:    { x:1560, y:880 },
    PROFILE_NPC:{ x:2300, y:880 },
    TRADE_NPC_A:{ x:1800, y:880 },
    TRADE_NPC_B:{ x:2040, y:880 },
    EVENT_PORTAL:{ x:380, y:1700, w:120, h:80 },
    BAR_COUNTER: { x:300, y:780, w:2700, h:38 },
    BAR_STOOLS: Array.from({length:38},(_,i)=>({x:340+i*70, y:840})),
    BOOTHS: [
      {x:140, y:1040},{x:140, y:1120},{x:140, y:1200},{x:140, y:1280},{x:140, y:1360},{x:140, y:1440},
      {x:3160,y:1040},{x:3160,y:1120},{x:3160,y:1200},{x:3160,y:1280},{x:3160,y:1360},{x:3160,y:1440},
    ],
    TABLES: [
      {x:800, y:1300,w:80,h:50},{x:800, y:1500,w:80,h:50},
      {x:2400,y:1300,w:80,h:50},{x:2400,y:1500,w:80,h:50},
      {x:1200,y:1500,w:80,h:50},{x:2000,y:1500,w:80,h:50},
    ],
    // Trade tables — visually distinct flat surfaces near trade NPCs
    TRADE_TABLES: [
      {x:1760, y:940, w:80, h:50},
      {x:2000, y:940, w:80, h:50},
    ],
    WINDOWS: [
      {x:200, y:740, w:140, h:14},
      {x:500, y:740, w:140, h:14},
      {x:800, y:740, w:140, h:14},
      {x:1100,y:740, w:140, h:14},
      {x:1500,y:740, w:140, h:14},
      {x:1800,y:740, w:140, h:14},
      {x:2200,y:740, w:140, h:14},
      {x:2500,y:740, w:140, h:14},
      {x:2800,y:740, w:140, h:14},
      {x:300, y:1906,w:140, h:14},
      {x:700, y:1906,w:140, h:14},
      {x:2400,y:1906,w:140, h:14},
      {x:2800,y:1906,w:140, h:14},
    ],
    NEON_SIGNS: [
      {x:1660,y:800,text:'⌬ THE VAULT ⌬',color:'#ff4080',size:24},
      {x:680, y:1080,text:'LOUNGE', color:'#c080ff',size:14},
      {x:2640,y:1080,text:'LOUNGE',color:'#c080ff',size:14},
      {x:1660,y:1080,text:'· CENTRAL ·',color:'#ffc040',size:13},
      {x:1080,y:830,text:'SHOP',color:'#ffd040',size:9},
      {x:1320,y:830,text:'SQUAD',color:'#a0ffff',size:9},
      {x:1560,y:830,text:'JOB',color:'#80ffc0',size:9},
      {x:1800,y:830,text:'TRADE',color:'#ff90c0',size:9},
      {x:2040,y:830,text:'TRADE',color:'#ff90c0',size:9},
      {x:2300,y:830,text:'YOU',color:'#c0ffa0',size:9},
      {x:440,y:1660,text:'★ EVENT HALL ★',color:'#c0a0ff',size:14},
    ],
    NO_SMOKING_SIGNS: [
      {x:600,y:1600},{x:2700,y:1600},
    ],
    // Dead center cyberpunk plaza — holographic vault projection + urban density
    HOLOGRAM_PLAZA: {x:1660, y:1330}, // center point, render radius ~200
    // Urban kiosks scattered around the plaza
    KIOSKS: [
      {x:1380, y:1280, w:46, h:54, color:'#ff4080', label:'★ INFO'},
      {x:1894, y:1280, w:46, h:54, color:'#40d0ff', label:'☎ COMM'},
      {x:1380, y:1430, w:46, h:54, color:'#80ffc0', label:'⚡ FEED'},
      {x:1894, y:1430, w:46, h:54, color:'#ffd040', label:'⌬ SYNC'},
    ],
    // Holo-billboards (vertical signs)
    BILLBOARDS: [
      {x:1230, y:1330, color:'#ff4080', text:'CYBER\nVAULT\n2026'},
      {x:2090, y:1330, color:'#40d0ff', text:'NEW\nDROP\nLIVE'},
    ],
    // Plaza benches (sit decor — not interactive seats but adds density)
    PLAZA_BENCHES: [
      {x:1500, y:1440, w:80, h:16},
      {x:1740, y:1440, w:80, h:16},
      {x:1500, y:1220, w:80, h:16},
      {x:1740, y:1220, w:80, h:16},
    ],
    PK_OPENING: {x:200, y:1916, w:140, h:14},
    PK_OPENING_2: {x:3000, y:1916, w:140, h:14},
    ESCALATOR: {x:3212, y:1180, w:90, h:260},
  },

  // ── UPPER LOUNGE (east side, reached via escalator) ───────────
  UPPER_LOUNGE: {
    x:3300, y:740, w:560, h:1180,
    SPAWN: {x:3580, y:1180},
    TABLES: [
      {x:3380,y:880,w:80,h:50},{x:3680,y:880,w:80,h:50},
      {x:3380,y:1080,w:80,h:50},{x:3680,y:1080,w:80,h:50},
      {x:3380,y:1280,w:80,h:50},{x:3680,y:1280,w:80,h:50},
      {x:3380,y:1480,w:80,h:50},{x:3680,y:1480,w:80,h:50},
      {x:3380,y:1680,w:80,h:50},{x:3680,y:1680,w:80,h:50},
    ],
    LOUNGE_SEATS: [
      {x:3360,y:880},{x:3500,y:880},{x:3700,y:880},{x:3840,y:880},
      {x:3360,y:1080},{x:3500,y:1080},{x:3700,y:1080},{x:3840,y:1080},
      {x:3360,y:1280},{x:3500,y:1280},{x:3700,y:1280},{x:3840,y:1280},
      {x:3360,y:1480},{x:3500,y:1480},{x:3700,y:1480},{x:3840,y:1480},
      {x:3360,y:1680},{x:3500,y:1680},{x:3700,y:1680},{x:3840,y:1680},
    ],
    BAR: {x:3340, y:780, w:520, h:32},
    WINDOWS: [
      {x:3340,y:740,w:140,h:14},{x:3580,y:740,w:140,h:14},{x:3820,y:740,w:140,h:14},
      // East exterior wall — sky view
      {x:3846,y:880,w:14,h:120},
      {x:3846,y:1080,w:14,h:120},
      {x:3846,y:1280,w:14,h:120},
      {x:3846,y:1480,w:14,h:120},
      {x:3846,y:1680,w:14,h:120},
    ],
    // Weapon display racks — futuristic illuminated cases on north interior wall
    WEAPON_RACKS: [
      {x:3400,y:820,w:80,h:14,wpn:'pistol'},
      {x:3520,y:820,w:80,h:14,wpn:'smg'},
      {x:3640,y:820,w:80,h:14,wpn:'shotgun'},
      {x:3760,y:820,w:80,h:14,wpn:'rifle'},
    ],
    NEON_SIGNS: [
      {x:3580, y:780, text:'★ SKY LOUNGE ★', color:'#ffaa40', size:16},
      {x:3580, y:1180,text:'V·I·P', color:'#ffe060', size:20},
    ],
    ESCALATOR_OPENING: {x:3286, y:1180, w:14, h:260},
  },

  // ── PK ZONE ───────────────────────────────────────────────────
  PK: {
    x:200, y:1970, w:3000, h:560,
    floor:{x:228,y:1998,w:2944,h:504},
    spawns:[
      {x:400,y:2120},{x:3000,y:2120},{x:400,y:2400},{x:3000,y:2400},
      {x:900,y:2080},{x:2500,y:2080},{x:900,y:2440},{x:2500,y:2440},
      {x:1660,y:2260},{x:1300,y:2120},{x:2000,y:2400},
    ],
    entry:{x:200, y:1936, w:140, h:80}, // west opening to lobby
    entry2:{x:3000, y:1936, w:140, h:80}, // east opening to lobby
    vaultEntry:{x:1610, y:2520, w:100, h:14},
    respawn:3,
    neon:{x:1660,y:2000,text:'☠ PK ZONE — KILL ON SIGHT ☠',color:'#ff2040',size:18},
    covers:[
      // wider cover scatter to support vehicle combat
      {x:500,y:2160,w:80,h:70},{x:2620,y:2160,w:80,h:70},
      {x:760,y:2330,w:60,h:60},{x:2380,y:2330,w:60,h:60},
      {x:1100,y:2100,w:80,h:60},{x:2020,y:2100,w:80,h:60},
      {x:1100,y:2380,w:80,h:60},{x:2020,y:2380,w:80,h:60},
      {x:1660,y:2160,w:80,h:50},{x:1660,y:2360,w:80,h:50},
      {x:300,y:2280,w:60,h:80},{x:2840,y:2280,w:60,h:80},
      {x:1380,y:2240,w:60,h:60},{x:1760,y:2240,w:60,h:60},
    ],
  },

  // ── EVENT HOUSE (instance room, accessed via portal in lobby) ──
  EVENT_HOUSE: {
    x:3300, y:140, w:540, h:540, // top-east, above upper lounge (instanced, only entered via portal)
    floor:{x:3328,y:168,w:484,h:484},
    SPAWN: {x:3570, y:340},
    DANCE_FLOOR: {x:3400, y:280, w:340, h:220},
    BAR: {x:3340, y:190, w:460, h:24},
    SEATS: [
      {x:3380,y:560},{x:3450,y:560},{x:3520,y:560},{x:3590,y:560},{x:3660,y:560},{x:3730,y:560},{x:3800,y:560},
    ],
    DJ_NPC: {x:3570, y:200},
    NEON_SIGNS: [
      {x:3570, y:168, text:'★ EVENT HALL ★', color:'#c0a0ff', size:16},
      {x:3570, y:400, text:'CLUB FLOOR', color:'#ff60c0', size:10},
    ],
    EXIT_PAD: {x:3550, y:640, w:50, h:40},
    pkEnabled:true,
  },

  // ── VAULT ZONE (squad warfare) ────────────────────────────────
  VAULT_ZONE: {
    x:200, y:2540, w:3000, h:820,
    floor:{x:228,y:2568,w:2944,h:764},
    spawns:[
      {x:350,y:2640},{x:3050,y:2640},{x:350,y:3140},{x:3050,y:3140},
      {x:900,y:2640},{x:2500,y:2640},{x:900,y:3140},{x:2500,y:3140},
    ],
    entry:{x:1610, y:2520, w:100, h:80}, // opening from PK zone
    vault:{x:1600, y:2880, w:120, h:120}, // central vault
    vaultMaxHP: 2500,
    vaultRegenDelay: 10,
    vaultRegenRate: 2,
    respawn: 4,
    neon:{x:1660,y:2570,text:'⌬ VAULT ⌬',color:'#ffe060',size:20},
    covers:[
      {x:500,y:2720,w:80,h:60},{x:2740,y:2720,w:80,h:60},
      {x:500,y:3120,w:80,h:60},{x:2740,y:3120,w:80,h:60},
      {x:1200,y:2780,w:60,h:60},{x:2080,y:2780,w:60,h:60},
      {x:1200,y:3100,w:60,h:60},{x:2080,y:3100,w:60,h:60},
      {x:1400,y:2700,w:80,h:30},{x:1860,y:2700,w:80,h:30},
      {x:1400,y:3120,w:80,h:30},{x:1860,y:3120,w:80,h:30},
    ],
  },

  PERIMETER:{x:80, y:80, w:3780, h:3300},

  PLAYER: {
    speed: 175, radius: 13, maxHP: 120,
    dashSpeed: 520, dashDuration: 0.13, dashCooldown: 1.2, dashInv: 0.10,
  },

  WEAPONS: {
    pistol:  {id:'pistol', name:'Sidearm', damage:18, fireRate:3.6, bulletSpeed:420, spread:0.04,  magazine:14, reloadTime:1.0, pellets:1, color:'#ffe060', reloadSlow:0.92, type:'ranged'},
    smg:     {id:'smg',    name:'SMG',     damage:9,  fireRate:10,  bulletSpeed:380, spread:0.13,  magazine:32, reloadTime:1.6, pellets:1, color:'#60ffd0', reloadSlow:0.90, type:'ranged'},
    shotgun: {id:'shotgun',name:'Shotgun', damage:14, fireRate:1.5, bulletSpeed:320, spread:0.27,  magazine:6,  reloadTime:2.4, pellets:6, color:'#ff9050', reloadSlow:0.85, type:'ranged'},
    rifle:   {id:'rifle',  name:'Rifle',   damage:34, fireRate:1.3, bulletSpeed:560, spread:0.012, magazine:8,  reloadTime:2.2, pellets:1, color:'#80c0ff', reloadSlow:0.85, type:'ranged'},
    blade:   {id:'blade',  name:'Blade',   damage:38, fireRate:2.2, range:38,        spread:0,     magazine:0,  reloadTime:0,    pellets:0,color:'#e0e0ff', reloadSlow:1.0,  type:'melee'},
    katana:  {id:'katana', name:'Katana',  damage:50, fireRate:1.6, range:46,        spread:0,     magazine:0,  reloadTime:0,    pellets:0,color:'#ff60a0', reloadSlow:1.0,  type:'melee'},
  },
  WEAPON_ORDER:['pistol','smg','shotgun','rifle','blade','katana'],

  BULLET_RADIUS: 4,
  BULLET_LIFETIME: 2.0,
  MATCH_TIMER: 90,
  COUNTDOWN: 0,
  HPBAR_VISIBLE_DURATION: 1.8,

  VEHICLE: {
    speed: 360, radius: 18,
    // Scattered across lobby + PK zone
    spawn:[
      {x:900,y:1500},{x:1660,y:1500},{x:2400,y:1500},{x:1300,y:1700},{x:2000,y:1700},
      {x:600,y:2280},{x:2800,y:2280},{x:1660,y:2280},
    ],
  },

  ECONOMY: {
    STARTING_COINS: 500,
    SPAR_WIN: 500,
    PK_KILL: 100,
    VAULT_KILL: 100,
    VAULT_DAMAGE_REWARD_PER_HP: 0.5,
    SQUAD_CREATE_COST: 200,
    VAULT_OWN_COIN_PER_MIN: 1,
    JOB_DRINK_REWARD: 25,
    JOB_FAIL_PENALTY: 5,
    JOB_SHIFT_DURATION: 60,
    JOB_COOLDOWN: 30,
  },

  SHOP_ITEMS: {
    skin_gold:    {id:'skin_gold',    type:'gunSkin',  name:'Gold Plated',   price:1500, color:'#ffd040', tab:'classic'},
    skin_neon:    {id:'skin_neon',    type:'gunSkin',  name:'Neon Pulse',    price:1500, color:'#40ffff', tab:'classic'},
    skin_chrome:  {id:'skin_chrome',  type:'gunSkin',  name:'Chrome',        price:1500, color:'#e0e0ff', tab:'classic'},
    skin_blood:   {id:'skin_blood',   type:'gunSkin',  name:'Blood Steel',   price:1500, color:'#ff2040', tab:'classic'},
    head_visor:   {id:'head_visor',   type:'head',     name:'Visor Helm',    price:1200, color:'#202028', tab:'classic'},
    head_crown:   {id:'head_crown',   type:'head',     name:'Crown',         price:2000, color:'#ffd040', tab:'classic'},
    head_horns:   {id:'head_horns',   type:'head',     name:'Horns',         price:1200, color:'#1a0a0a', tab:'classic'},
    body_tac:     {id:'body_tac',     type:'body',     name:'Tactical Vest', price:1500, color:'#2a3540', tab:'classic'},
    body_robe:    {id:'body_robe',    type:'body',     name:'Crimson Robe',  price:1500, color:'#5a1818', tab:'classic'},
    body_neon:    {id:'body_neon',    type:'body',     name:'Neon Jacket',   price:2000, color:'#40c0ff', tab:'classic'},
    // 2026 LAUNCH — limited season drop
    head_zero:    {id:'head_zero',    type:'head',     name:'Zero Hood',     price:2200, color:'#101218', tab:'2026'},
    head_oracle:  {id:'head_oracle',  type:'head',     name:'Oracle Mask',   price:2600, color:'#ff4080', tab:'2026'},
    head_void:    {id:'head_void',    type:'head',     name:'Void Helm',     price:3000, color:'#5a30a0', tab:'2026'},
    body_shroud:  {id:'body_shroud',  type:'body',     name:'Shroud Suit',   price:2200, color:'#0a0a14', tab:'2026'},
    body_lumen:   {id:'body_lumen',   type:'body',     name:'Lumen Coat',    price:2800, color:'#80a0ff', tab:'2026'},
    cloak_smoke:  {id:'cloak_smoke',  type:'cloak',    name:'Smoke Cloak',   price:1800, color:'#3a3a4a', tab:'2026'},
    cloak_crimson:{id:'cloak_crimson',type:'cloak',    name:'Crimson Cloak', price:2000, color:'#a02030', tab:'2026'},
    cloak_neon:   {id:'cloak_neon',   type:'cloak',    name:'Neon Cape',     price:2400, color:'#40d0ff', tab:'2026'},
    cloak_gold:   {id:'cloak_gold',   type:'cloak',    name:'Gilded Cloak',  price:3200, color:'#ffd060', tab:'2026'},
    cloak_void:   {id:'cloak_void',   type:'cloak',    name:'Void Cloak',    price:3600, color:'#1a0830', tab:'2026'},
    skin_katana:  {id:'skin_katana',  type:'gunSkin',  name:'Katana Edge',   price:1800, color:'#ff60a0', tab:'2026'},
    skin_void:    {id:'skin_void',    type:'gunSkin',  name:'Void Finish',   price:2400, color:'#7040c0', tab:'2026'},
    // Unlockable (not buyable)
    hat_vault:    {id:'hat_vault',    type:'head',     name:'Vault Crown',   price:0,    color:'#ffe080', unlockOnly:true, tab:'classic'},
  },
  SHOP_TABS: [
    {id:'classic', name:'CLASSIC'},
    {id:'2026',    name:'2026 LAUNCH'},
  ],
  EQUIP_SLOTS: ['gunSkin', 'head', 'body', 'cloak'],

  SQUAD: { MAX_MEMBERS: 10, VAULT_HOLD_HOURS_FOR_HAT: 300 },

  DIFFICULTY: {
    easy:  {name:'Rookie', reaction:0.34,aimError:0.26,speed:0.70,dodgeChance:0.006,aggression:0.18},
    medium:{name:'Veteran',reaction:0.20,aimError:0.15,speed:0.85,dodgeChance:0.015,aggression:0.30},
    hard:  {name:'Elite',  reaction:0.10,aimError:0.06,speed:0.98,dodgeChance:0.030,aggression:0.48},
  },

  BODY_COLORS:['#4a6090','#8a4040','#4a8060','#7a4080','#408080','#7a6840','#404880','#8a5828','#5a5a5a','#3070a0'],
  ACCENT_COLORS:['#5aafff','#ff7a5a','#6acc90','#ba7aff','#5affff','#ffba50','#5a9aff','#ff8a40','#aaff60','#7a7aff'],
  HEAD_COLORS:['#e8c8a0','#e4a888','#c8a878','#f0d0a8','#aa8868','#e8b080','#d09868','#f0d0a0','#b88060','#f0e0c0'],
  HAIR_COLORS:['#3a2a1a','#5a2a10','#28284a','#4a3818','#1a1a1a','#5a4018','#3a1818','#48482a','#6a4818','#101010'],

  EMOTES:[
    {key:'gg',text:'GG'},{key:'ez',text:'too easy.'},{key:'lets',text:"let's go!"},
    {key:'hi',text:'sup'},{key:'wow',text:'wow.'},{key:'2step',text:'*2-steps*',dance:true},
  ],

  NAME_BANK:['Cipher','Vex','Kade','Rune','Nox','Lyra','Zael','Sable','Omen','Flick','Dusk','Juno','Axe','Wren','Slate','Nova','Croft','Pixel','Echo','Blaze','Ghost','Riot','Vapor','Onyx','Quill','Talon','Mirage','Drift','Cobra','Saint'],

  GUIDE_LINES:[
    "Welcome to The Vault.",
    "4 spar rooms: top-left/right, mid-left/right.",
    "Walk to a spar entry to queue or fight a bot.",
    "Sit in seats outside a spar to spectate.",
    "Central lobby connects everything.",
    "South opening → PK zone (anyone can shoot).",
    "PK leads deeper south → Vault zone (squads).",
    "East escalator → Sky Lounge (V·I·P).",
    "Bartender NPC pays vault coins.",
    "1-5 keys = pick weapon anytime.",
    "Type '2step' in chat to dance.",
    "E mounts/dismounts vehicles.",
  ],

  ANTICHEAT: {
    MAX_INPUTS_PER_SEC: 120,
    MAX_CHAT_PER_SEC: 2,
    MAX_DM_PER_SEC: 4,
    MAX_ACTION_PER_SEC: 8,
    MAX_POS_DIVERGENCE: 80,
  },
};

if (typeof module !== 'undefined') module.exports = SHARED;
