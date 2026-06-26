// shared/constants.js — v6.8 (brutalist, varied spars, new weapons, trade room)
'use strict';

const SHARED = {
  TICK_RATE: 60,
  MAX_PLAYERS: 30,
  WORLD: { W: 3120, H: 2400 },
  CAMERA: { W: 800, H: 600 },

  // ── SPAR COMPLEX — varied sizes/shapes, all closed ──
  SPAR_ROOMS: {
    classic: {
      name:'Classic', label:'1v1',
      x:140, y:140, w:380, h:340,
      floor:{x:168,y:168,w:324,h:284},
      spawn:[{x:240,y:300},{x:420,y:300}],
      maxHP:160,
      queueMarker:{x:330,y:540},
      neon:{x:330,y:158,text:'CLASSIC',color:'#d8d8d8',size:13},
      specSeats:[
        {x:200,y:540},{x:260,y:540},{x:330,y:540},{x:400,y:540},{x:460,y:540},
      ],
      queueBoard:{x:230,y:580},
    },
    iron: {
      name:'Iron', label:'1v1 · close · 240HP',
      x:2660, y:160, w:280, h:240,
      floor:{x:2688,y:188,w:224,h:184},
      spawn:[{x:2740,y:280},{x:2860,y:280}],
      maxHP:240,
      queueMarker:{x:2800,y:440},
      neon:{x:2800,y:178,text:'IRON',color:'#e0303a',size:13},
      specSeats:[
        {x:2720,y:440},{x:2780,y:440},{x:2820,y:440},{x:2880,y:440},
      ],
      queueBoard:{x:2720,y:478},
    },
    melee: {
      name:'Melee', label:'vs Bot · Blade only',
      x:1380, y:160, w:240, h:240,
      floor:{x:1408,y:188,w:184,h:184},
      spawn:[{x:1460,y:280},{x:1540,y:280}],
      maxHP:140,
      queueMarker:{x:1500,y:440},
      neon:{x:1500,y:178,text:'⚔ MELEE',color:'#d8d8d8',size:13},
      specSeats:[
        {x:1430,y:440},{x:1480,y:440},{x:1520,y:440},{x:1570,y:440},
      ],
      queueBoard:{x:1430,y:478},
      meleeOnly:true,
      autoBot:true,
    },
    blitz: {
      name:'Blitz', label:'1v1 · corridor · 100HP fast',
      x:120, y:1080, w:200, h:420,
      floor:{x:148,y:1108,w:144,h:364},
      spawn:[{x:220,y:1180},{x:220,y:1400}],
      maxHP:100,
      queueMarker:{x:220,y:1040},
      neon:{x:220,y:1098,text:'BLITZ',color:'#e0303a',size:12},
      specSeats:[
        {x:140,y:1040},{x:180,y:1040},{x:260,y:1040},{x:300,y:1040},
      ],
      queueBoard:{x:140,y:1578},
    },
    twos: {
      name:'2v2', label:'2 vs 2 · wide',
      x:2560, y:1080, w:480, h:340,
      floor:{x:2588,y:1108,w:424,h:284},
      spawn:[{x:2660,y:1180},{x:2660,y:1320},{x:2940,y:1180},{x:2940,y:1320}],
      maxHP:180,
      queueMarker:{x:2800,y:1040},
      neon:{x:2800,y:1098,text:'2v2',color:'#d8d8d8',size:13},
      specSeats:[
        {x:2660,y:1040},{x:2730,y:1040},{x:2800,y:1040},{x:2870,y:1040},{x:2940,y:1040},
      ],
      queueBoard:{x:2680,y:1058},
    },
    showdown: {
      name:'Showdown', label:'10 player FFA · 2000⌬',
      x:1080, y:1040, w:500, h:480,
      floor:{x:1108,y:1068,w:444,h:424},
      spawn:[
        {x:1140,y:1100},{x:1520,y:1100},{x:1140,y:1480},{x:1520,y:1480},
        {x:1330,y:1100},{x:1330,y:1480},{x:1140,y:1290},{x:1520,y:1290},
        {x:1220,y:1170},{x:1440,y:1170},
      ],
      maxHP:200,
      queueMarker:{x:1330,y:1000},
      neon:{x:1330,y:1058,text:'⚡ SHOWDOWN ⚡',color:'#e03a30',size:14},
      specSeats:[
        {x:1180,y:1020},{x:1250,y:1020},{x:1330,y:1020},{x:1410,y:1020},{x:1480,y:1020},
      ],
      queueBoard:{x:1200,y:1040},
      showdown:true,
      maxPlayers:10,
      minPlayers:2,
      prize:2000,
    },
  },

  // ── MAIN LOBBY — brutalist, decentered, accessible ────────────
  LOBBY: {
    x:80, y:580, w:2440, h:480,
    SPAWN_AREA: { x:1430, y:780, w:200, h:140 },
    GUIDE_NPC:  { x:200,  y:780 },
    SHOP_NPC:   { x:760,  y:780 },
    SQUAD_NPC:  { x:920,  y:780 },
    JOB_NPC:    { x:1080, y:780 },
    PROFILE_NPC:{ x:1700, y:780 },
    // Trade NPCs moved into TRADE_ROOM
    BAR_COUNTER: { x:260, y:620, w:2080, h:14 },
    BAR_STOOLS: Array.from({length:20},(_,i)=>({x:340+i*100, y:660})),
    BOOTHS: [
      {x:130, y:760},{x:130, y:840},{x:130, y:920},
      {x:2380,y:760},{x:2380,y:840},{x:2380,y:920},
    ],
    TABLES: [
      {x:560, y:920,w:60,h:40},{x:660, y:920,w:60,h:40},
      {x:1860,y:920,w:60,h:40},{x:1960,y:920,w:60,h:40},
    ],
    TRADE_TABLES: [],
    WINDOWS: [
      {x:200, y:580, w:140, h:10},{x:460, y:580, w:140, h:10},
      {x:720, y:580, w:140, h:10},{x:980, y:580, w:140, h:10},
      {x:1240,y:580, w:140, h:10},{x:1500,y:580, w:140, h:10},
      {x:1760,y:580, w:140, h:10},{x:2020,y:580, w:140, h:10},
      {x:2280,y:580, w:140, h:10},
      {x:240, y:1050,w:140, h:10},{x:540, y:1050,w:140, h:10},
      {x:1900,y:1050,w:140, h:10},{x:2200,y:1050,w:140, h:10},
    ],
    NEON_SIGNS: [
      {x:200,y:730,text:'GUIDE',color:'#d8d8d8',size:9},
      {x:760,y:730,text:'SHOP',color:'#d8d8d8',size:9},
      {x:920,y:730,text:'SQUAD',color:'#d8d8d8',size:9},
      {x:1080,y:730,text:'JOB',color:'#d8d8d8',size:9},
      {x:1700,y:730,text:'PROFILE',color:'#d8d8d8',size:9},
    ],
    NO_SMOKING_SIGNS: [{x:540,y:1000},{x:2060,y:1000}],
    // Center plaza simplified — single brutalist monolith, NO holo cube
    MONOLITH: {x:1300, y:880, w:60, h:140},
    KIOSKS: [],       // removed clutter
    BILLBOARDS: [],   // removed clutter
    PLAZA_BENCHES: [
      {x:1180, y:920, w:80, h:14},
      {x:1380, y:920, w:80, h:14},
    ],
    // Brutalist concrete pillars at the starting plaza (decor, not walls)
    PILLARS: [
      {x:1380, y:740, w:20, h:20},
      {x:1660, y:740, w:20, h:20},
      {x:1380, y:940, w:20, h:20},
      {x:1660, y:940, w:20, h:20},
    ],
    PK_OPENING: {x:600, y:1056, w:200, h:12},
    PK_OPENING_2: {x:1900, y:1056, w:200, h:12},
    ESCALATOR: {x:2512, y:780, w:78, h:230},
    TRADE_OPENING: {x:1700, y:580, w:80, h:12}, // opening in north wall of lobby → trade room
  },

  // ── TRADE ROOM — separate enclosure, 4 tables ─────────────────
  TRADE_ROOM: {
    x:1640, y:300, w:280, h:280,
    floor:{x:1668,y:328,w:224,h:244},
    SPAWN: {x:1780, y:540},
    entry:{x:1700, y:568, w:80, h:12}, // south opening (matches LOBBY.TRADE_OPENING)
    TABLES: [
      {x:1700, y:380, w:60, h:46},
      {x:1820, y:380, w:60, h:46},
      {x:1700, y:480, w:60, h:46},
      {x:1820, y:480, w:60, h:46},
    ],
    TRADE_NPCS: [
      {x:1720, y:360},{x:1840, y:360},
      {x:1720, y:460},{x:1840, y:460},
    ],
    neon:{x:1780, y:318, text:'■ TRADE ■', color:'#e03a30', size:14},
  },

  // ── UPPER LOUNGE ──────────────────────────────────────────────
  UPPER_LOUNGE: {
    x:2600, y:580, w:480, h:480,
    SPAWN: {x:2840, y:780},
    TABLES: [
      {x:2680,y:720,w:60,h:40},{x:2940,y:720,w:60,h:40},
      {x:2680,y:880,w:60,h:40},{x:2940,y:880,w:60,h:40},
      {x:2680,y:1000,w:60,h:40},{x:2940,y:1000,w:60,h:40},
    ],
    LOUNGE_SEATS: [
      {x:2660,y:720},{x:2780,y:720},{x:2920,y:720},{x:3040,y:720},
      {x:2660,y:880},{x:2780,y:880},{x:2920,y:880},{x:3040,y:880},
      {x:2660,y:1000},{x:2780,y:1000},{x:2920,y:1000},{x:3040,y:1000},
    ],
    BAR: {x:2640, y:620, w:440, h:14},
    WINDOWS: [
      {x:2640,y:580,w:120,h:10},{x:2820,y:580,w:120,h:10},{x:3000,y:580,w:80,h:10},
      {x:3066,y:720,w:10,h:120},{x:3066,y:880,w:10,h:120},
    ],
    WEAPON_RACKS: [
      {x:2680,y:660,w:60,h:10,wpn:'pistol'},
      {x:2780,y:660,w:60,h:10,wpn:'smg'},
      {x:2880,y:660,w:60,h:10,wpn:'shotgun'},
      {x:2980,y:660,w:60,h:10,wpn:'rifle'},
    ],
    NEON_SIGNS: [
      {x:2840, y:620, text:'★ SKY LOUNGE ★', color:'#d8d8d8', size:14},
      {x:2840, y:840, text:'V·I·P', color:'#d8d8d8', size:18},
    ],
    ESCALATOR_OPENING: {x:2588, y:780, w:12, h:230},
  },

  // ── PK ZONE — brutalist subway underground ────────────────────
  PK: {
    x:200, y:1580, w:2240, h:420,
    floor:{x:228,y:1608,w:2184,h:364},
    subway:true,
    spawns:[
      {x:340,y:1700},{x:2300,y:1700},{x:340,y:1900},{x:2300,y:1900},
      {x:780,y:1660},{x:1860,y:1660},{x:780,y:1960},{x:1860,y:1960},
      {x:1320,y:1800},{x:1100,y:1700},{x:1540,y:1900},
    ],
    entry:{x:600, y:1568, w:200, h:14},
    entry2:{x:1900, y:1568, w:200, h:14},
    vaultEntry:{x:1280, y:1988, w:80, h:14},
    respawn:3,
    neon:{x:1320,y:1610,text:'⊟ UNDERGROUND ⊟',color:'#e03a30',size:16},
    covers:[
      {x:600,y:1700,w:24,h:60},{x:1000,y:1700,w:24,h:60},{x:1640,y:1700,w:24,h:60},{x:2040,y:1700,w:24,h:60},
      {x:600,y:1830,w:24,h:60},{x:1000,y:1830,w:24,h:60},{x:1640,y:1830,w:24,h:60},{x:2040,y:1830,w:24,h:60},
      {x:780,y:1760,w:80,h:18},{x:1340,y:1760,w:80,h:18},{x:1860,y:1760,w:80,h:18},
      {x:380,y:1780,w:40,h:46},{x:2200,y:1780,w:40,h:46},
      {x:1180,y:1700,w:140,h:14},{x:1180,y:1880,w:140,h:14},
    ],
    TRACKS: [
      {x:228, y:1655, w:2184, h:18},
      {x:228, y:1945, w:2184, h:18},
    ],
    STATION_SIGNS: [
      {x:480, y:1610, text:'⊟ STATION 7'},
      {x:1320, y:1610, text:'⊟ CENTRAL'},
      {x:2180, y:1610, text:'⊟ EAST'},
    ],
  },

  VAULT_ZONE: {
    x:200, y:2020, w:2240, h:340,
    floor:{x:228,y:2048,w:2184,h:284},
    spawns:[
      {x:340,y:2100},{x:2300,y:2100},{x:340,y:2280},{x:2300,y:2280},
      {x:780,y:2100},{x:1860,y:2100},{x:780,y:2280},{x:1860,y:2280},
    ],
    entry:{x:1280, y:2008, w:80, h:14},
    vault:{x:1280, y:2160, w:100, h:100},
    vaultMaxHP: 3000,
    vaultRegenDelay: 10,
    vaultRegenRate: 2,
    respawn: 4,
    neon:{x:1320,y:2050,text:'■ VAULT ■',color:'#e0e0e0',size:18},
    covers:[
      {x:440,y:2100,w:70,h:50},{x:2130,y:2100,w:70,h:50},
      {x:440,y:2240,w:70,h:50},{x:2130,y:2240,w:70,h:50},
      {x:980,y:2080,w:50,h:50},{x:1610,y:2080,w:50,h:50},
      {x:980,y:2240,w:50,h:50},{x:1610,y:2240,w:50,h:50},
      {x:1100,y:2080,w:70,h:24},{x:1450,y:2080,w:70,h:24},
    ],
  },

  PERIMETER:{x:80, y:80, w:3000, h:2300},

  PLAYER: {
    speed: 175, radius: 13, maxHP: 160, // bumped
    dashSpeed: 520, dashDuration: 0.13, dashCooldown: 1.2, dashInv: 0.10,
  },

  WEAPONS: {
    pistol:  {id:'pistol', name:'Sidearm', damage:18, fireRate:3.6, bulletSpeed:420, spread:0.04,  magazine:14, reloadTime:1.0, pellets:1, color:'#d8d8d8', reloadSlow:0.92, type:'ranged', bulletStyle:'standard'},
    smg:     {id:'smg',    name:'SMG',     damage:9,  fireRate:10,  bulletSpeed:380, spread:0.13,  magazine:32, reloadTime:1.6, pellets:1, color:'#b8b8b8', reloadSlow:0.90, type:'ranged', bulletStyle:'tracer'},
    shotgun: {id:'shotgun',name:'Shotgun', damage:14, fireRate:1.5, bulletSpeed:320, spread:0.27,  magazine:6,  reloadTime:2.4, pellets:6, color:'#a0a0a0', reloadSlow:0.85, type:'ranged', bulletStyle:'pellet'},
    rifle:   {id:'rifle',  name:'Rifle',   damage:32, fireRate:1.2, bulletSpeed:560, spread:0.012, magazine:8,  reloadTime:2.2, pellets:1, color:'#d0d0d0', reloadSlow:0.85, type:'ranged', bulletStyle:'sharp'},
    blade:   {id:'blade',  name:'Blade',   damage:38, fireRate:2.2, range:38,        spread:0,     magazine:0,  reloadTime:0,    pellets:0,color:'#e8e8e8', reloadSlow:1.0,  type:'melee'},
    katana:  {id:'katana', name:'Katana',  damage:48, fireRate:1.6, range:46,        spread:0,     magazine:0,  reloadTime:0,    pellets:0,color:'#e03a30', reloadSlow:1.0,  type:'melee'},
    // ── NEW ──
    laser:   {id:'laser',  name:'Laser',   damage:8,  fireRate:14,  bulletSpeed:900, spread:0,     magazine:30, reloadTime:1.8, pellets:1, color:'#e03a30', reloadSlow:0.88, type:'ranged', bulletStyle:'beam'},
    rodgun:  {id:'rodgun', name:'Rod Gun', damage:42, fireRate:0.8, bulletSpeed:680, spread:0.005, magazine:4,  reloadTime:2.6, pellets:1, color:'#a0a0a0', reloadSlow:0.82, type:'ranged', bulletStyle:'rod'},
  },
  WEAPON_ORDER:['pistol','smg','shotgun','rifle','laser','rodgun','blade','katana'],

  JETPACK: {
    speedMul: 1.75,
    fuelMax: 1.0,
    drainPerSec: 0.10,   // 10s of full flight
    rechargePerSec: 0.07,  // ~14s to refill
    minActivate: 0.15,   // need at least 15% to start
  },

  BULLET_RADIUS: 4,
  BULLET_LIFETIME: 2.0,
  MATCH_TIMER: 90,
  COUNTDOWN: 0,
  HPBAR_VISIBLE_DURATION: 1.8,

  VEHICLE: {
    speed: 360, radius: 18,
    spawn:[
      {x:680,y:980},{x:1300,y:1000},{x:1920,y:980},
      {x:540,y:1300},{x:2100,y:1300},{x:1320,y:1450},
    ],
  },

  ECONOMY: {
    STARTING_COINS: 500,
    SPAR_WIN: 500,
    SHOWDOWN_WIN: 2000,
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

  BODY_COLORS:['#3a3a44','#5a3a3a','#3a4a3a','#4a3a4a','#3a4a4a','#5a4a3a','#3a3a5a','#5a4828','#444444','#28384a'],
  ACCENT_COLORS:['#d8d8d8','#e03a30','#a0a0a0','#c8c8c8','#9aa0a8','#b04040','#888888','#e8e8e8','#d04040','#666666'],
  HEAD_COLORS:['#e8c8a0','#e4a888','#c8a878','#f0d0a8','#aa8868','#e8b080','#d09868','#f0d0a0','#b88060','#f0e0c0'],
  HAIR_COLORS:['#1a1a1a','#3a2a1a','#5a2a10','#28284a','#4a3818','#0a0a0a','#5a4018','#3a1818','#48482a','#101010'],

  EMOTES:[
    {key:'gg',text:'GG'},{key:'ez',text:'too easy.'},{key:'lets',text:"let's go!"},
    {key:'hi',text:'sup'},{key:'wow',text:'wow.'},{key:'2step',text:'*2-steps*',dance:true},
  ],

  NAME_BANK:['Cipher','Vex','Kade','Rune','Nox','Lyra','Zael','Sable','Omen','Flick','Dusk','Juno','Axe','Wren','Slate','Nova','Croft','Pixel','Echo','Blaze','Ghost','Riot','Vapor','Onyx','Quill','Talon','Mirage','Drift','Cobra','Saint'],

  GUIDE_LINES:[
    "Welcome to The Vault.",
    "6 spars: Classic (TL), Iron (TR small/240HP),",
    "Melee (TC vs Bot), Blitz (ML narrow), 2v2 (MR), Showdown (C, 10 FFA, 2000⌬).",
    "Walk to a spar's queue pad — F to enter.",
    "Sit on spec seats around a spar to watch.",
    "North-center → TRADE ROOM (4 tables, gift coins).",
    "South openings → PK (subway killzone).",
    "PK → Vault (squad combat, 3000HP vault).",
    "East escalator → Sky Lounge.",
    "1-8 keys = pick weapon. Includes laser + rod gun.",
    "E mounts/dismounts vehicles. Reload + fire mounted.",
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
