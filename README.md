# elysium forum + marketplace

live multi-user **forum** + **marketplace** — german lowercase ui, dark cyberpunk theme.

**not** localStorage-only. shared server-backed state (cloudflare workers + kv) for all visitors.

## live urls

| what | url |
|------|-----|
| **live app (https ui + api)** | **https://elysium-forum.helpful-mojoceratops.workers.dev** |
| github pages mirror | https://digitaldesignerjazz.github.io/elysium-forum/ |
| repo | https://github.com/digitaldesignerjazz/elysium-forum |

> **keep-alive:** the workers deploy used a temporary cloudflare preview account (free). **claim it within ~60 minutes** so it stays forever on the free workers tier (no credit card):  
> https://dash.cloudflare.com/claim-preview?claimToken=FV1cI0b9HyFCLN9uuqXqP003fW6bT4gATWk5tDu6XC0  
> after claiming: run `wrangler login` once, then `npx wrangler deploy` (drop `--temporary`).

pages mirror talks to the same https workers api (no mixed content / no bore).

## diagnosis (why old urls failed)

- **bore.pub:61039** — tunnel process died / unreachable from the public internet (connection failed).
- **github pages** — static only; `config.js` pointed at dead **http://** bore → browsers block mixed content on https pages, and `/api` 404s on pages itself.
- **cloudflared quick tunnels** — provisioning returned HTTP 429 (rate limit).

## features

### forum
- thread list (title, nickname, time, reply count)
- create thread / replies — shared across all browsers

### marketplace
- shared listings + mod actions (flaggen / entfernen / wiederherstellen)
- seeds legal demo listings if empty

### rules banner
only legal goods — no drugs / weapons / stolen goods / csam.

## architecture (free)

1. **cloudflare worker** serves UI assets + `/api/*`
2. **workers kv** holds shared `store` (multi-isolate / multi-user)
3. **github pages** optional mirror (same frontend, `apiBase` → workers https)

## local

```bash
npm install
npm start
# open http://127.0.0.1:8877  (avoid box port 8787 if occupied)
```

## deploy / redeploy

```bash
./scripts/deploy-worker.sh
# after claim + wrangler login:
cd worker && npx wrangler deploy
```

## api

- `GET /api/health`
- `GET|POST /api/threads`
- `GET /api/threads/:id`
- `POST /api/threads/:id/replies`
- `GET|POST /api/listings`
- `POST /api/listings/:id/flag|remove|restore`

## license

mit · built for sven (digitaldesignerjazz) / elysium
