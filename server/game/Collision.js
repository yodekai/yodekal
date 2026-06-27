// server/game/Collision.js
'use strict';
function circleRect(cx,cy,cr,rx,ry,rw,rh){const nx=Math.max(rx,Math.min(cx,rx+rw)),ny=Math.max(ry,Math.min(cy,ry+rh));const dx=cx-nx,dy=cy-ny,d2=dx*dx+dy*dy;if(d2>=cr*cr)return null;const d=Math.sqrt(d2)||.001;return{nx:dx/d,ny:dy/d,depth:cr-d};}
function resolveWalls(ent,r,walls){for(const w of walls){const p=circleRect(ent.x,ent.y,r,w.x,w.y,w.w,w.h);if(p){ent.x+=p.nx*p.depth;ent.y+=p.ny*p.depth;}}}
function bulletHitsWall(x0,y0,x1,y1,walls){let best=null;for(const w of walls){let tmin=0,tmax=1;const dx=x1-x0,dy=y1-y0;for(let a=0;a<2;a++){const d=a===0?dx:dy,o=a===0?x0:y0,lo=a===0?w.x:w.y,hi=lo+(a===0?w.w:w.h);if(Math.abs(d)<1e-8){if(o<lo||o>hi){tmax=-1;break;}}else{let t1=(lo-o)/d,t2=(hi-o)/d;if(t1>t2){const t=t1;t1=t2;t2=t;}tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);}}if(tmin<=tmax&&(best===null||tmin<best))best=tmin;}return best;}
module.exports={resolveWalls,circleRect,bulletHitsWall};
