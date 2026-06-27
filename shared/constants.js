// shared/constants.js — v6.8 (brutalist, varied spars, new weapons, trade room)
'use strict';

const SHARED = {
  TICK_RATE: 60,
  MAX_PLAYERS: 30,
  WORLD: { W: 3120, H: 2920 },
  CAMERA: { W: 800, H: 600 },

  // ── COMMUNITY SPAR COMPLEX — single centralized cluster ──
  SPAR_ROOMS: {
    classic: {
      name:'Classic', label:'1v1',
      x:680, y:140, w:320, h:300,
      floor:{x:708,y:168,w:264,h:244},
      spawn:[{x:760,y:280},{x:920,y:280}],
      maxHP:160,
      queueMarker:{x:840,y:480},
      neon:{x:840,y:158,text:'CLASSIC',color:'#d8d8d8',size:12},
      specSeats:[
        {x:740,y:480},{x:790,y:480},{x:840,y:480},{x:890,y:480},{x:940,y:480},
      ],
      queueBoard:{x:740,y:518},
    },
    melee: {
      name:'Melee', label:'vs Bot · Blade',
      x:1060, y:140, w:240, h:240,
      floor:{x:1088,y:168,w:184,h:184},
      spawn:[{x:1140,y:260},{x:1220,y:260}],
      maxHP:140,
      queueMarker:{x:1180,y:420},
      neon:{x:1180,y:158,text:'⚔ MELEE',color:'#d8d8d8',size:12},
      specSeats:[
        {x:1100,y:420},{x:1150,y:420},{x:1200,y:420},{x:1250,y:420},
      ],
      queueBoard:{x:1110,y:458},
      meleeOnly:true,
      autoBot:true,
    },
    iron: {
      name:'Iron', label:'1v1 close · 240HP',
      x:1340, y:140, w:240, h:240,
      floor:{x:1368,y:168,w:184,h:184},
      spawn:[{x:1420,y:260},{x:1500,y:260}],
      maxHP:240,
      queueMarker:{x:1460,y:420},
      neon:{x:1460,y:158,text:'IRON',color:'#e0303a',size:12},
      specSeats:[
        {x:1380,y:420},{x:1430,y:420},{x:1480,y:420},{x:1540,y:420},
      ],
      queueBoard:{x:1390,y:458},
    },
    blitz: {
      name:'Blitz', label:'narrow · 100HP fast',
      x:1640, y:140, w:200, h:380,
      floor:{x:1668,y:168,w:144,h:324},
      spawn:[{x:1740,y:220},{x:1740,y:440}],
      maxHP:100,
      queueMarker:{x:1740,y:560},
      neon:{x:1740,y:158,text:'BLITZ',color:'#e0303a',size:12},
      specSeats:[
        {x:1660,y:560},{x:1700,y:560},{x:1780,y:560},{x:1820,y:560},
      ],
      queueBoard:{x:1660,y:598},
    },
    arena: {
      name:'Arena', label:'4-6 FFA · 1000⌬',
      x:2300, y:140, w:580, h:380,
      floor:{x:2328,y:168,w:524,h:324},
      spawn:[
        {x:2380,y:230},{x:2800,y:230},
        {x:2380,y:430},{x:2800,y:430},
        {x:2590,y:280},{x:2590,y:380},
      ],
      maxHP:180,
      queueMarker:{x:2590,y:560},
      neon:{x:2590,y:158,text:'△ ARENA △',color:'#e0a040',size:14},
      specSeats:[
        {x:2400,y:560},{x:2500,y:560},{x:2590,y:560},{x:2680,y:560},{x:2780,y:560},
      ],
      queueBoard:{x:2440,y:598},
      maxPlayers:6, minPlayers:2,
      showdown:true, // FFA mode
      prize:1000,
      obstacles:[
        {x:2450, y:280, w:14, h:60}, {x:2730, y:280, w:14, h:60},
        {x:2450, y:380, w:14, h:60}, {x:2730, y:380, w:14, h:60},
        {x:2590, y:330, w:40, h:14},
      ],
    },
    twos: {
      name:'2v2', label:'2 vs 2 · wide',
      x:1880, y:140, w:380, h:300,
      floor:{x:1908,y:168,w:324,h:244},
      spawn:[{x:1960,y:240},{x:1960,y:340},{x:2200,y:240},{x:2200,y:340}],
      maxHP:180,
      queueMarker:{x:2070,y:480},
      neon:{x:2070,y:158,text:'2v2',color:'#d8d8d8',size:12},
      specSeats:[
        {x:1960,y:480},{x:2010,y:480},{x:2070,y:480},{x:2130,y:480},{x:2180,y:480},
      ],
      queueBoard:{x:1980,y:518},
    },
    showdown: {
      name:'Showdown', label:'2-10 player FFA · 2000⌬',
      x:740, y:760, w:1060, h:560,
      floor:{x:768,y:788,w:1004,h:504},
      spawn:[
        {x:820,y:840},{x:1080,y:840},{x:1390,y:840},{x:1700,y:840},
        {x:820,y:1240},{x:1080,y:1240},{x:1390,y:1240},{x:1700,y:1240},
        {x:1270,y:1050},{x:1020,y:1050},
      ],
      obstacles:[
        {x:920, y:940, w:60, h:14},   {x:1560,y:940, w:60, h:14},
        {x:920, y:1160,w:60, h:14},   {x:1560,y:1160,w:60, h:14},
        {x:1110,y:880, w:14, h:60},   {x:1410,y:880, w:14, h:60},
        {x:1110,y:1200,w:14, h:60},   {x:1410,y:1200,w:14, h:60},
        {x:1230,y:1030,w:60, h:30},
        {x:820, y:1030,w:24, h:80},
        {x:1740,y:1030,w:24, h:80},
      ],
      maxHP:200,
      queueMarker:{x:1270,y:1360},
      neon:{x:1280,y:598,text:'⚡ SHOWDOWN ⚡',color:'#e03a30',size:18},
      specSeats:[
        {x:1050,y:1360},{x:1130,y:1360},{x:1210,y:1360},{x:1290,y:1360},{x:1370,y:1360},{x:1450,y:1360},
        {x:740,y:880,side:'west'},{x:740,y:1000,side:'west'},{x:740,y:1120,side:'west'},
        {x:1800,y:880,side:'east'},{x:1800,y:1000,side:'east'},{x:1800,y:1120,side:'east'},
      ],
      queueBoard:{x:1100,y:1400},
      showdown:true,
      maxPlayers:10,
      minPlayers:2,
      prize:2000,
    },
  },

  // ── MAIN LOBBY — brutalist, decentered, accessible ────────────
  LOBBY: {
    x:80, y:1440, w:2960, h:540,
    SPAWN_AREA: { x:1430, y:1620, w:200, h:140 },
    GUIDE_NPC:  { x:1320, y:1620 },
    SHOP_NPC:   { x:1420, y:1620 },
    SQUAD_NPC:  { x:1520, y:1620 },
    JOB_NPC:    { x:1620, y:1620 },
    PROFILE_NPC:{ x:1720, y:1620 },
    // Trade NPCs moved into TRADE_ROOM
    BAR_COUNTER: { x:0, y:0, w:0, h:0 }, // removed — replaced by CENTERPIECE
    CENTERPIECE: { x:200, y:1520, w:400, h:80 }, // cyberpunk neon ecosystem
    BAR_STOOLS: [],
    BOOTHS: [],
    TABLES: [],
    TRADE_TABLES: [],
    WINDOWS: [
      {x:200, y:1440, w:140, h:10},{x:460, y:1440, w:140, h:10},
      {x:720, y:1440, w:140, h:10},{x:980, y:1440, w:140, h:10},
      {x:1240,y:1440, w:140, h:10},{x:1500,y:1440, w:140, h:10},
      {x:1760,y:1440, w:140, h:10},{x:2020,y:1440, w:140, h:10},
      {x:2280,y:1440, w:140, h:10},{x:2540,y:1440, w:140, h:10},
      {x:2800,y:1440, w:140, h:10},
    ],
    NEON_SIGNS: [
      {x:200,y:1570,text:'GUIDE',color:'#d8d8d8',size:9},
      {x:1320,y:1510,text:'SHOP',color:'#d8d8d8',size:9},
      {x:1430,y:1510,text:'SQUAD',color:'#d8d8d8',size:9},
      {x:1540,y:1510,text:'JOB',color:'#d8d8d8',size:9},
      {x:1650,y:1510,text:'PROFILE',color:'#d8d8d8',size:9},
    ],
    NO_SMOKING_SIGNS: [],
    // Center plaza simplified — single brutalist monolith, NO holo cube
    MONOLITH: {x:1820, y:1660, w:30, h:140},
    KIOSKS: [],       // removed clutter
    BILLBOARDS: [],   // removed clutter
    PLAZA_BENCHES: [
      {x:1450, y:1800, w:80, h:14},
      {x:1600, y:1800, w:80, h:14},
    ],
    // Brutalist concrete pillars at the starting plaza (decor, not walls)
    PILLARS: [
      {x:1380, y:1560, w:20, h:20},
      {x:1680, y:1560, w:20, h:20},
      {x:1380, y:1800, w:20, h:20},
      {x:1680, y:1800, w:20, h:20},
    ],
    PK_OPENING: {x:600, y:1976, w:200, h:14},
    SAFE_ZONE: {x:1280, y:1500, w:540, h:340}, // safe bubble around spawn + NPCs
    PK_OPENING_2: {x:1900, y:1976, w:200, h:14},
    ESCALATOR: {x:2780, y:1440, w:80, h:14},
    CHESS_TABLE: {x:2820, y:1300, w:80, h:80}, // chess board + 2 seats
    CHESS_SEATS: [{x:2820, y:1280}, {x:2900, y:1280}, {x:2820, y:1380}, {x:2900, y:1380}],
    // Second chess table near spawn (in safe zone) — shared board state
    CHESS_TABLE_SPAWN: {x:1500, y:1500, w:80, h:80},
    CHESS_SEATS_SPAWN: [{x:1500, y:1480}, {x:1580, y:1480}, {x:1500, y:1580}, {x:1580, y:1580}],
    // Glowing ATMs — decorative
    ATMS: [
      {x:1290, y:1530}, {x:1810, y:1530},
    ],
    // Spawn holograms — rotating glowing figures around spawn
    HOLOGRAMS: [
      {x:1340, y:1780, kind:'fighter'},
      {x:1720, y:1780, kind:'vault'},
      {x:1530, y:1780, kind:'logo'},
    ],
    // Big chess sign pointing east toward Sky Lounge
    CHESS_ARROW: {x:1900, y:1700, target:'east'},
    // Glowing floor lamps (yellow halo on dark tiles)
    FLOOR_LAMPS: [
      {x:200,  y:1500}, {x:600,  y:1500}, {x:1000, y:1500},
      {x:2040, y:1500}, {x:2440, y:1500}, {x:2840, y:1500},
      {x:200,  y:1900}, {x:1000, y:1900},
      {x:2040, y:1900}, {x:2840, y:1900},
    ],
    // Decorative cyberpunk planters (glowing teal at base, like screenshots)
    PLANTERS: [
      {x:700,  y:1620}, {x:880,  y:1620},
      {x:2160, y:1620}, {x:2340, y:1620},
      {x:700,  y:1880}, {x:880,  y:1880},
      {x:2160, y:1880}, {x:2340, y:1880},
    ],
    // SHOP item displays with price tags (inspired by screenshots)
    SHOP_DISPLAY: {
      x:1380, y:1450, w:240, h:50,
      items:[
        {x:1410, y:1465, wpn:'rifle',   price:1500},
        {x:1500, y:1465, wpn:'ripper',  price:2500},
        {x:1590, y:1465, wpn:'rodgun',  price:3500},
      ],
    },
    // ── MEGACITY decor (decorative; behind the action) ──
    MEGACITY: {
      SKYLINE: [
        {x:120,  y:1450, w:80,  h:90,  windows:9, color:'#1a1a22'},
        {x:220,  y:1450, w:60,  h:120, windows:12,color:'#0e0e16'},
        {x:300,  y:1450, w:100, h:75,  windows:8, color:'#16161e'},
        {x:420,  y:1450, w:70,  h:110, windows:11,color:'#0a0a12'},
        {x:520,  y:1450, w:90,  h:85,  windows:9, color:'#14141c'},
        {x:640,  y:1450, w:60,  h:130, windows:13,color:'#08080e'},
        {x:740,  y:1450, w:100, h:80,  windows:8, color:'#12121a'},
        {x:880,  y:1450, w:80,  h:95,  windows:10,color:'#0c0c14'},
        {x:1000, y:1450, w:70,  h:105, windows:11,color:'#10101a'},
        {x:2080, y:1450, w:100, h:80,  windows:8, color:'#14141c'},
        {x:2200, y:1450, w:60,  h:120, windows:12,color:'#0a0a12'},
        {x:2300, y:1450, w:90,  h:90,  windows:9, color:'#10101a'},
        {x:2420, y:1450, w:70,  h:130, windows:13,color:'#08080e'},
        {x:2520, y:1450, w:100, h:75,  windows:8, color:'#16161e'},
        {x:2640, y:1450, w:80,  h:100, windows:10,color:'#12121a'},
      ],
      BILLBOARDS: [
        {x:300,  y:1470, w:130, h:34, frames:['SUMPTUOUS DETAIL','DOWNTOWN','★ VIP ★'], color:'#e03a30'},
        {x:780,  y:1470, w:130, h:34, frames:['VAULTZONE','EARN ⌬','RANK UP'], color:'#80c0ff'},
        {x:2380, y:1470, w:130, h:34, frames:['SHOWDOWN 2000⌬','PK +50⌬','ARENA 1000⌬'], color:'#a0e060'},
      ],
      DRONES: [
        {x:300, y:1480, speed:60, alt:18},
        {x:1500,y:1490, speed:-50, alt:14},
        {x:2500,y:1500, speed:70, alt:22},
      ],
      VENTS: [
        {x:760, y:1700}, {x:2120, y:1700},
        {x:480, y:1880}, {x:2400, y:1880},
      ],
      GRID_LINES: [
        {x:80, y:1700, w:2960, h:1, dir:'h'},
        {x:80, y:1850, w:2960, h:1, dir:'h'},
      ],
    },
    TRADE_OPENING: {x:180, y:1440, w:80, h:14}, // opening in north wall of lobby → trade room
  },

  // ── TRADE ROOM — 4 tables, west of lobby ──────────────────────
  TRADE_ROOM: {
    x:80, y:1180, w:280, h:260,
    floor:{x:108,y:1208,w:224,h:224},
    SPAWN: {x:220, y:1420},
    entry:{x:180, y:1432, w:80, h:14},
    TABLES: [
      {x:120, y:1248, w:60, h:46},
      {x:240, y:1248, w:60, h:46},
      {x:120, y:1336, w:60, h:46},
      {x:240, y:1336, w:60, h:46},
    ],
    TRADE_NPCS: [
      {x:140, y:1228},{x:260, y:1228},
      {x:140, y:1316},{x:260, y:1316},
    ],
    SAFE: true,
    neon:{x:220, y:1198, text:'■ TRADE ■', color:'#e03a30', size:14},
    // Decorative slot machines along east wall
    SLOTS: [
      {x:330, y:1240}, {x:330, y:1290}, {x:330, y:1340}, {x:330, y:1390},
    ],
  },

  // ── UPPER LOUNGE ──────────────────────────────────────────────
  UPPER_LOUNGE: {
    x:2660, y:1180, w:380, h:260,
    SPAWN: {x:2850, y:1420},
    TABLES: [
      {x:2700,y:1248,w:60,h:40},{x:2900,y:1248,w:60,h:40},
      {x:2700,y:1336,w:60,h:40},{x:2900,y:1336,w:60,h:40},
    ],
    LOUNGE_SEATS: [
      {x:2680,y:1248},{x:2780,y:1248},{x:2880,y:1248},{x:2980,y:1248},
      {x:2680,y:1336},{x:2780,y:1336},{x:2880,y:1336},{x:2980,y:1336},
    ],
    BAR: {x:2680, y:1208, w:340, h:10},
    WINDOWS: [
      {x:2680,y:1180,w:120,h:10},{x:2860,y:1180,w:120,h:10},
    ],
    WEAPON_RACKS: [],
    NEON_SIGNS: [
      {x:2850, y:1198, text:'★ SKY LOUNGE ★', color:'#d8d8d8', size:12},
    ],
    ESCALATOR_OPENING: {x:2780, y:1432, w:80, h:14},
    SAFE: true,
    // Decorative props around chess table
    LOUNGE_PROPS: [
      {kind:'coffee', x:2810, y:1320},
      {kind:'coffee', x:2910, y:1320},
      {kind:'cigar',  x:2830, y:1370},
      {kind:'cigar',  x:2890, y:1370},
      {kind:'ashtray',x:2860, y:1410},
      {kind:'newspaper',x:2700, y:1280},
      {kind:'lamp',   x:2700, y:1410},
      {kind:'lamp',   x:3000, y:1410},
    ],
    // Chess sign — big and bold
    CHESS_SIGN: {x:2860, y:1230, text:'♛ CHESS ROOM'},
  },

  // ── PK ZONE — brutalist subway underground ────────────────────
  PK: {
    x:200, y:2000, w:2240, h:440,
    floor:{x:228,y:2028,w:2184,h:384},
    subway:true,
    spawns:[
      {x:340,y:2080},{x:2300,y:2080},{x:340,y:2260},{x:2300,y:2260},
      {x:780,y:2120},{x:1860,y:2120},{x:780,y:2360},{x:1860,y:2360},
      {x:1320,y:2200},{x:1100,y:2120},{x:1540,y:2280},
    ],
    entry:{x:600, y:1988, w:200, h:14},
    entry2:{x:1900, y:1988, w:200, h:14},
    vaultEntry:{x:1280, y:2428, w:80, h:14},
    vaultWarp:{x:300, y:2070, w:60, h:60}, // warp pad upper-left → vault
    respawn:3,
    neon:{x:1320,y:2030,text:'⊟ UNDERGROUND ⊟',color:'#e03a30',size:14},
    covers:[
      {x:600,y:2080,w:24,h:60},{x:1000,y:2080,w:24,h:60},{x:1640,y:2080,w:24,h:60},{x:2040,y:2080,w:24,h:60},
      {x:600,y:2300,w:24,h:60},{x:1000,y:2300,w:24,h:60},{x:1640,y:2300,w:24,h:60},{x:2040,y:2300,w:24,h:60},
      {x:780,y:2200,w:80,h:18},{x:1340,y:2200,w:80,h:18},{x:1860,y:2200,w:80,h:18},
      {x:1180,y:2080,w:140,h:14},{x:1180,y:2360,w:140,h:14},
      {x:380,y:2200,w:40,h:46},{x:2200,y:2200,w:40,h:46},
    ],
    TRACKS: [
      {x:228, y:2155, w:2184, h:14},
      {x:228, y:2295, w:2184, h:14},
    ],
    STATION_SIGNS: [
      {x:480, y:2030, text:'⊟ STATION 7'},
      {x:1320, y:2030, text:'⊟ CENTRAL'},
      {x:2180, y:2030, text:'⊟ EAST'},
    ],
  },

  VAULT_ZONE: {
    x:200, y:2460, w:2240, h:320,
    floor:{x:228,y:2488,w:2184,h:264},
    spawns:[
      {x:340,y:2540},{x:2300,y:2540},{x:340,y:2700},{x:2300,y:2700},
      {x:780,y:2540},{x:1860,y:2540},{x:780,y:2700},{x:1860,y:2700},
    ],
    entry:{x:1280, y:2448, w:80, h:14},
    vault:{x:1280, y:2600, w:100, h:100},
    vaultMaxHP: 3000,
    vaultRegenDelay: 10,
    vaultRegenRate: 2,
    respawn: 4,
    neon:{x:1320,y:2480,text:'■ VAULT ■',color:'#e0e0e0',size:18},
    covers:[
      {x:440,y:2540,w:70,h:50},{x:2130,y:2540,w:70,h:50},
      {x:440,y:2700,w:70,h:50},{x:2130,y:2700,w:70,h:50},
      {x:980,y:2520,w:50,h:50},{x:1610,y:2520,w:50,h:50},
      {x:980,y:2700,w:50,h:50},{x:1610,y:2700,w:50,h:50},
      {x:1100,y:2520,w:70,h:24},{x:1450,y:2520,w:70,h:24},
    ],
  },

  // ── WATER RACE — multiplayer race event ──────────────────
  WATER_RACE: {
    x:200, y:1840, w:2200, h:130,
    floor:{x:228, y:1868, w:2144, h:74},
    queueMarker:{x:240, y:1988},
    minPlayers:2,
    maxPlayers:4,
    duration:90,
    prize:500,
    // race lanes - start (west) → finish (east)
    lanes:[
      {x:250, y:1880}, {x:250, y:1905}, {x:250, y:1930}, {x:250, y:1955},
    ],
    startX:260,
    finishX:2370,
    // SLALOM obstacles forcing zigzag — alternating top/bottom/middle
    obstacles:[
      {x:380,  y:1870, w:18, h:30}, {x:480,  y:1930, w:18, h:30},
      {x:580,  y:1900, w:18, h:24},
      {x:680,  y:1870, w:18, h:30}, {x:780,  y:1930, w:18, h:30},
      {x:880,  y:1900, w:18, h:24},
      {x:980,  y:1870, w:18, h:30}, {x:1080, y:1930, w:18, h:30},
      {x:1180, y:1900, w:18, h:24},
      {x:1280, y:1870, w:18, h:30}, {x:1380, y:1930, w:18, h:30},
      {x:1480, y:1900, w:18, h:24},
      {x:1580, y:1870, w:18, h:30}, {x:1680, y:1930, w:18, h:30},
      {x:1780, y:1900, w:18, h:24},
      {x:1880, y:1870, w:18, h:30}, {x:1980, y:1930, w:18, h:30},
      {x:2080, y:1900, w:18, h:24},
      {x:2180, y:1870, w:18, h:30}, {x:2280, y:1930, w:18, h:30},
    ],
    // CHECKPOINTS — players must pass these in order (anti-cheat + segment markers)
    checkpoints:[
      {x:780, label:'1/3'},
      {x:1480, label:'2/3'},
      {x:2080, label:'3/3'},
    ],
    speedMul: 0.78, // slower in water — skill-tested controls
  },

  PERIMETER:{x:80, y:80, w:3000, h:2820},

  PLAYER: {
    speed: 175, radius: 13, maxHP: 160,
    accelTime: 0.13, // 0.13s ramp from 0 to full speed (movement weight)
    dashSpeed: 520, dashDuration: 0.13, dashCooldown: 1.2, dashInv: 0.10,
  },

  WEAPONS: {
    pistol:  {id:'pistol', name:'Sidearm', damage:18, fireRate:3.6, bulletSpeed:420, spread:0.04,  magazine:14, reloadTime:1.0, pellets:1, color:'#d8d8d8', reloadSlow:0.92, type:'ranged', bulletStyle:'standard'},
    smg:     {id:'smg',    name:'SMG',     damage:9,  fireRate:10,  bulletSpeed:380, spread:0.08,  magazine:32, reloadTime:1.6, pellets:1, color:'#b8b8b8', reloadSlow:0.90, type:'ranged', bulletStyle:'tracer'},
    shotgun: {id:'shotgun',name:'Shotgun', damage:14, fireRate:1.5, bulletSpeed:320, spread:0.27,  magazine:6,  reloadTime:2.4, pellets:6, color:'#a0a0a0', reloadSlow:0.85, type:'ranged', bulletStyle:'pellet'},
    rifle:   {id:'rifle',  name:'Rifle',   damage:32, fireRate:1.2, bulletSpeed:560, spread:0.012, magazine:8,  reloadTime:2.2, pellets:1, color:'#d0d0d0', reloadSlow:0.85, type:'ranged', bulletStyle:'sharp'},
    ripper:  {id:'ripper', name:'Ripper',  damage:24, fireRate:3.8, bulletSpeed:600, spread:0.04,  magazine:18, reloadTime:1.6, pellets:1, color:'#e03a30', reloadSlow:0.86, type:'ranged', bulletStyle:'sharp'},
    shredder:{id:'shredder',name:'Shredder',damage:20, fireRate:5.2, bulletSpeed:540, spread:0.06, magazine:24, reloadTime:1.5, pellets:1, color:'#ff6040', reloadSlow:0.88, type:'ranged', bulletStyle:'tracer'},
    stinger: {id:'stinger', name:'Stinger', damage:28, fireRate:3.0, bulletSpeed:640, spread:0.025,magazine:12, reloadTime:1.4, pellets:1, color:'#a040e0', reloadSlow:0.86, type:'ranged', bulletStyle:'sharp'},
    blade:   {id:'blade',  name:'Blade',   damage:38, fireRate:2.2, range:38,        spread:0,     magazine:0,  reloadTime:0,    pellets:0,color:'#e8e8e8', reloadSlow:1.0,  type:'melee'},
    katana:  {id:'katana', name:'Katana',  damage:48, fireRate:1.6, range:46,        spread:0,     magazine:0,  reloadTime:0,    pellets:0,color:'#e03a30', reloadSlow:1.0,  type:'melee'},
    nunchaku:{id:'nunchaku',name:'Nunchaku',damage:34,fireRate:3.0,range:34,       spread:0,     magazine:0,  reloadTime:0,    pellets:0,color:'#d8d8d8', reloadSlow:1.0,  type:'melee'},
    mace:    {id:'mace',   name:'Mace',    damage:62, fireRate:1.0, range:42,      spread:0,     magazine:0,  reloadTime:0,    pellets:0,color:'#9a9a9a', reloadSlow:1.0,  type:'melee'},
    laser:   {id:'laser',  name:'Laser',   damage:8,  fireRate:14,  bulletSpeed:720, spread:0,     magazine:30, reloadTime:1.8, pellets:1, color:'#e03a30', reloadSlow:0.88, type:'ranged', bulletStyle:'beam'},
    laser2:  {id:'laser2', name:'Pulse',   damage:24, fireRate:2.4, bulletSpeed:780, spread:0.02,  magazine:10, reloadTime:1.6, pellets:1, color:'#ff8060', reloadSlow:0.88, type:'ranged', bulletStyle:'pulse'},
    rodgun:  {id:'rodgun', name:'Rod Gun', damage:46, fireRate:0.9, bulletSpeed:720, spread:0.004, magazine:4,  reloadTime:2.4, pellets:1, color:'#a0a0a0', reloadSlow:0.84, type:'ranged', bulletStyle:'rod'},
  },
  WEAPON_ORDER:['pistol','smg','shotgun','rifle','ripper','shredder','stinger','laser','laser2','rodgun','blade','katana','nunchaku','mace'],

  JETPACK: {
    speedMul: 1.75,
    fuelMax: 1.0,
    drainPerSec: 0.10,   // 10s of full flight
    rechargePerSec: 0.07,  // ~14s to refill
    minActivate: 0.15,   // need at least 15% to start
  },

  BULLET_RADIUS: 4,
  BULLET_LIFETIME: 2.4,
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
    KILLZONE_KILL: 50,
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
