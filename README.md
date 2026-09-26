# elysium forum + marketplace

live multi-user **forum** + **marketplace** — german lowercase ui, dark cyberpunk theme.

**not** localStorage-only. shared server-backed state for all visitors.

## live urls

| what | url |
|------|-----|
| live app (api + ui via tunnel) | see `public/config.js` → `apiBase` (trycloudflare) |
| github pages mirror | https://digitaldesignerjazz.github.io/elysium-forum/ |
| repo | https://github.com/digitaldesignerjazz/elysium-forum |

pages mirror uses the same frontend and reads `config.js` for the live api base.

## features

### forum
- thread list (title, nickname, time, reply count)
- create thread
- open thread + post replies
- shared across all browsers

### marketplace
- shared listings: title, description, category, price, status (`aktiv` \| `geflaggt` \| `entfernt`)
- create listing
- mod actions always visible: **flaggen**, **entfernen**, **wiederherstellen**
- seeds ~8 legal listings once if empty

### rules banner
only legal goods — no drugs / weapons / stolen goods / csam.

## architecture (free forever-tier)

1. **node/express api** on the agent box (`server/`) with json store
2. **durable backup** via github contents api → `data/store.json` (authenticated `gh`)
3. **public reachability** via **cloudflared quick tunnel** (free, no cf account)
4. **github pages** hosts the static spa mirror

> caveat: trycloudflare urls change when the tunnel restarts. `scripts/keepalive.sh` restarts the stack and updates `public/config.js`. for a stable hostname, deploy the included cloudflare worker (free workers tier — needs one free cf login, no card).

## local

```bash
npm install
npm start
# open http://127.0.0.1:8787
```

## live start (box)

```bash
./scripts/start-live.sh
# then optionally:
./scripts/keepalive.sh
```

## api

- `GET /api/health`
- `GET|POST /api/threads`
- `GET /api/threads/:id`
- `POST /api/threads/:id/replies`
- `GET|POST /api/listings`
- `POST /api/listings/:id/flag|remove|restore`

## upgrade path: cloudflare workers

see `worker/` — hono-style worker + kv binding. deploy with `npx wrangler deploy` after `wrangler login` (free cf account, no credit card required for workers free tier).

## license

mit · built for sven (digitaldesignerjazz) / elysium
