// server/game/Worldgen.js — generates walls for the v6 world
'use strict';
const C = require('../../shared/constants');

function _addRoomWalls(walls, r, openings) {
  // openings = array of opening rects to cut out from the perimeter walls
  const T = 12;
  const sides = [
    {x:r.x, y:r.y, w:r.w, h:T, axis:'h'},                    // top
    {x:r.x, y:r.y+r.h-T, w:r.w, h:T, axis:'h'},               // bottom
    {x:r.x, y:r.y, w:T, h:r.h, axis:'v'},                     // left
    {x:r.x+r.w-T, y:r.y, w:T, h:r.h, axis:'v'},               // right
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
          if (lft.w > 4) next.push(lft);
          if (rgt.w > 4) next.push(rgt);
        } else {
          const top = {x:seg.x, y:seg.y, w:seg.w, h:Math.max(0, o.y-seg.y), axis:'v'};
          const bot = {x:seg.x, y:o.y+o.h, w:seg.w, h:Math.max(0,(seg.y+seg.h)-(o.y+o.h)), axis:'v'};
          if (top.h > 4) next.push(top);
          if (bot.h > 4) next.push(bot);
        }
      }
      segs = next;
    }
    for (const seg of segs) walls.push({x:seg.x, y:seg.y, w:seg.w, h:seg.h});
  }
}

function buildWalls() {
  const walls = [];
  const P = C.PERIMETER, T = 12;

  // World perimeter
  walls.push({x:P.x, y:P.y, w:P.w, h:T});
  walls.push({x:P.x, y:P.y+P.h-T, w:P.w, h:T});
  walls.push({x:P.x, y:P.y, w:T, h:P.h});
  walls.push({x:P.x+P.w-T, y:P.y, w:T, h:P.h});

  // Spar rooms — FULLY CLOSED (no openings, queue teleports players in)
  for (const k in C.SPAR_ROOMS) {
    const r = C.SPAR_ROOMS[k];
    _addRoomWalls(walls, r, []);
  }

  // PK zone — 2 openings from lobby, 1 to vault
  _addRoomWalls(walls, C.PK, [C.PK.entry, C.PK.entry2, C.PK.vaultEntry]);
  for (const c of C.PK.covers) walls.push({...c});

  // Vault zone — 1 opening from PK
  _addRoomWalls(walls, C.VAULT_ZONE, [C.VAULT_ZONE.entry]);
  for (const c of C.VAULT_ZONE.covers) walls.push({...c});

  // Upper lounge perimeter
  _addRoomWalls(walls, C.UPPER_LOUNGE, [C.UPPER_LOUNGE.ESCALATOR_OPENING]);

  const bc = C.LOBBY.BAR_COUNTER; walls.push({x:bc.x, y:bc.y, w:bc.w, h:6}); // thin railing only (passable around it)
  for (const t of C.LOBBY.TABLES) walls.push({x:t.x, y:t.y, w:t.w, h:t.h});
  if (C.LOBBY.TRADE_TABLES) for (const t of C.LOBBY.TRADE_TABLES) walls.push({x:t.x, y:t.y, w:t.w, h:t.h});
  for (const t of C.UPPER_LOUNGE.TABLES) walls.push({x:t.x, y:t.y, w:t.w, h:t.h});
  const ub = C.UPPER_LOUNGE.BAR;
  walls.push({x:ub.x, y:ub.y, w:ub.w, h:6}); // also thin only
  // Trade room walls
  if (C.TRADE_ROOM) {
    _addRoomWalls(walls, C.TRADE_ROOM, [C.TRADE_ROOM.entry]);
    for (const t of C.TRADE_ROOM.TABLES || []) walls.push({x:t.x, y:t.y, w:t.w, h:t.h});
  }

  return walls;
}

function zoneOf(x, y) {
  for (const k in C.SPAR_ROOMS) {
    const r = C.SPAR_ROOMS[k];
    if (x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h) return {type:'spar', key:k, room:r};
  }
  if (x>=C.PK.x && x<=C.PK.x+C.PK.w && y>=C.PK.y && y<=C.PK.y+C.PK.h) return {type:'pk', room:C.PK};
  const v = C.VAULT_ZONE;
  if (x>=v.x && x<=v.x+v.w && y>=v.y && y<=v.y+v.h) return {type:'vault', room:v};
  const u = C.UPPER_LOUNGE;
  if (x>=u.x && x<=u.x+u.w && y>=u.y && y<=u.y+u.h) return {type:'upper'};
  if (C.TRADE_ROOM) {
    const tr = C.TRADE_ROOM;
    if (x>=tr.x && x<=tr.x+tr.w && y>=tr.y && y<=tr.y+tr.h) return {type:'trade'};
  }
  return {type:'lobby'};
}

module.exports = { buildWalls, zoneOf };
