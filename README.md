# VaultZone v6.0

A multiplayer browser-based arena game. Top-down, fast-paced, with a persistent economy, squads, vault warfare, and a multi-floor lobby.

## What's new in v6

- **Email-based accounts.** Sign up to keep your coins, stats, owned skins, and squad across sessions. No verification, no password — your email is just the account ID.
- **Guest mode.** Play without an account; stats reset each session.
- **Vault coins (⌬).** Earn by winning spars (+500), PK kills (+100), vault damage, bartender shifts, and owning the vault as a squad.
- **Shop.** Buy gun skins, alt heads, alt bodies. Equip per slot.
- **Squads.** Create (200 ⌬) or join. Max 10 members. Tag shown above your name.
- **Vault zone.** Below PK is a vault siege area with a central 1500-HP vault. Squads can claim and hold it. **300 cumulative hours of ownership** unlocks the Vault Crown hat for every member of the holding squad.
- **Multi-floor lobby.** Take the east-side escalator up to the Sky Lounge.
- **Spar complex.** All 4 rooms grouped at the top: Classic, Iron (200 HP), Blitz (small), 2v2. Spectator seats are *outside* each room — sit to focus-spectate that fight.
- **Bartender job.** Walk to the bartender NPC, press F, pour drinks in the right colors. +25 ⌬ per order, -5 ⌬ on a wrong pour. 60s shift, 30s cooldown.
- **Anti-cheat basics.** Rate-limited inputs / chat / DMs / actions. Server-only currency. Spar-room push-out for non-fighters. Bullet wall checks, etc.
- **Always-on weapon selector.** Press 1–5 anywhere to switch weapons. Your weapon is rendered on you in the lobby too.
- **Brighter palette.** Lobby and lounge lifted out of the dark-club look — slate-purple floor, warm wood bar, gold accents in the Sky Lounge.

## Run it

Mac / Linux:

```
bash play.sh
```

That installs deps (first run only) and opens http://localhost:3000.

## Controls

- **WASD / arrows** — move
- **Mouse** — aim
- **Click / hold left mouse** — shoot
- **1–5** — pick weapon (pistol / SMG / shotgun / rifle / blade)
- **R** — reload
- **Space** — dash
- **F** — interact (NPCs, queue, etc.)
- **E** — mount / dismount vehicle
- **Q** — quick chat
- **Y** — emote bar
- **Esc** — close panels

Mobile gets dual virtual joysticks and on-screen action buttons.

## Files

```
vaultzone6/
├── play.sh          ← launcher
├── server/
│   ├── index.js     ← http + sockets
│   ├── db.js        ← JSON storage for accounts + squads
│   └── game/
│       ├── GameRoom.js
│       ├── Player.js
│       ├── Worldgen.js
│       ├── Collision.js
│       ├── Vault.js
│       └── Job.js
├── client/
│   ├── index.html
│   └── game.js
├── shared/
│   └── constants.js ← world layout, weapons, shop items, etc.
└── data/            ← created on first run; holds accounts.json + squads.json
```

## Sharing this with friends

For a quick demo: install ngrok and run `ngrok http 3000` while the server is running.

For a permanent deploy: push to GitHub, then deploy with Railway or Render (they auto-redeploy on git push). The server already binds to `0.0.0.0` and reads `process.env.PORT`.
