/**
 * Cloudflare Worker + KV backend for elysium-forum.
 * Serves UI (assets) + /api/* with shared multi-user state.
 */

const SEED_LISTINGS = [
  { id: "seed-1", title: "neon terminal ui kit", description: "figma + svg komponenten für dunkle dashboards. inkl. buttons, cards, charts.", category: "design", price: "29 €", status: "aktiv", createdAt: "2026-09-01T10:00:00.000Z" },
  { id: "seed-2", title: "static site cli", description: "leichtes node-cli zum bauen und previewen von static sites. mit watch-mode.", category: "software", price: "free / open source", status: "aktiv", createdAt: "2026-09-02T11:30:00.000Z" },
  { id: "seed-3", title: "mechanical keyboard switches (unused)", description: "packung 70× gateron yellow pro (linear), unbenutzt, originalverpackt.", category: "hardware", price: "35 €", status: "aktiv", createdAt: "2026-09-03T09:15:00.000Z" },
  { id: "seed-4", title: "logo & brand sprint (remote)", description: "2-tägiger remote design-sprint: moodboard, 3 richtungen, finale dateien (svg/png).", category: "dienstleistung", price: "ab 350 €", status: "aktiv", createdAt: "2026-09-04T14:00:00.000Z" },
  { id: "seed-5", title: "cyberpunk worldbuilding workbook", description: "pdf-workbook mit prompts für settings, fraktionen und street-level stories.", category: "buch", price: "12 €", status: "aktiv", createdAt: "2026-09-05T16:45:00.000Z" },
  { id: "seed-6", title: "elysium enamel pin set", description: "3er set hard-enamel pins (netz, node, signal). nickelfrei, inkl. backing cards.", category: "merch", price: "18 €", status: "aktiv", createdAt: "2026-09-06T12:00:00.000Z" },
  { id: "seed-7", title: "markdown notes sync tool", description: "desktop-app (win/mac/linux) zum syncen von markdown-ordnern via eigene api.", category: "software", price: "9 € one-time", status: "aktiv", createdAt: "2026-09-07T08:20:00.000Z" },
  { id: "seed-8", title: "icon pack · 120 line icons", description: "monochrome line icons (24px), svg + png. inkl. figma library.", category: "design", price: "15 €", status: "aktiv", createdAt: "2026-09-08T13:10:00.000Z" },
];

const SEED_THREADS = [
  {
    id: "thread-welcome",
    title: "willkommen im elysium forum",
    nickname: "nexus",
    body: "dies ist das live multi-user forum. threads und replies sind server-backed und für alle besucher sichtbar. bitte bleib freundlich und legal.",
    createdAt: "2026-09-20T12:00:00.000Z",
    replies: [
      {
        id: "reply-welcome-1",
        nickname: "lyra",
        body: "schön hier zu sein — marketplace-tab für legale listings, forum für diskussion.",
        createdAt: "2026-09-20T12:15:00.000Z",
      },
    ],
  },
];

const STORE_KEY = "elysium:store";

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function bad(msg, status = 400) {
  return json({ error: msg }, status);
}

function cleanText(s, max) {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

function nanoid(size = 10) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = "";
  for (let i = 0; i < size; i++) id += alphabet[bytes[i] % alphabet.length];
  return id;
}

function emptyStore() {
  return { threads: [], listings: [], updatedAt: new Date().toISOString() };
}

function ensureSeed(data) {
  let changed = false;
  if (!Array.isArray(data.listings) || data.listings.length === 0) {
    data.listings = SEED_LISTINGS.map((l) => ({ ...l }));
    changed = true;
  }
  if (!Array.isArray(data.threads) || data.threads.length === 0) {
    data.threads = SEED_THREADS.map((t) => ({
      ...t,
      replies: (t.replies || []).map((r) => ({ ...r })),
    }));
    changed = true;
  }
  return changed;
}

async function loadStore(env) {
  if (!env.STORE) throw new Error("KV binding STORE missing");
  const raw = await env.STORE.get(STORE_KEY);
  let data = raw ? JSON.parse(raw) : emptyStore();
  if (ensureSeed(data)) {
    data.updatedAt = new Date().toISOString();
    await env.STORE.put(STORE_KEY, JSON.stringify(data));
  }
  return data;
}

async function saveStore(env, data) {
  data.updatedAt = new Date().toISOString();
  await env.STORE.put(STORE_KEY, JSON.stringify(data));
  return data;
}

async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  if (path === "/api/health" && method === "GET") {
    const s = await loadStore(env);
    return json({
      ok: true,
      service: "elysium-forum-worker",
      threads: s.threads.length,
      listings: s.listings.length,
      updatedAt: s.updatedAt,
    });
  }

  if (path === "/api/threads" && method === "GET") {
    const threads = (await loadStore(env)).threads
      .map((t) => ({
        id: t.id,
        title: t.title,
        nickname: t.nickname,
        createdAt: t.createdAt,
        replyCount: (t.replies || []).length,
        preview: (t.body || "").slice(0, 140),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json({ threads });
  }

  if (path === "/api/threads" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const nickname = cleanText(body?.nickname, 40);
    const title = cleanText(body?.title, 120);
    const text = cleanText(body?.body, 4000);
    if (!nickname || !title || !text) return bad("nickname, title und body sind Pflicht.");
    const thread = {
      id: nanoid(10),
      nickname,
      title,
      body: text,
      createdAt: new Date().toISOString(),
      replies: [],
    };
    const s = await loadStore(env);
    s.threads.push(thread);
    await saveStore(env, s);
    return json({ thread }, 201);
  }

  const threadMatch = path.match(/^\/api\/threads\/([^/]+)$/);
  if (threadMatch && method === "GET") {
    const thread = (await loadStore(env)).threads.find((t) => t.id === threadMatch[1]);
    if (!thread) return bad("thread nicht gefunden.", 404);
    return json({ thread });
  }

  const replyMatch = path.match(/^\/api\/threads\/([^/]+)\/replies$/);
  if (replyMatch && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const nickname = cleanText(body?.nickname, 40);
    const text = cleanText(body?.body, 4000);
    if (!nickname || !text) return bad("nickname und body sind Pflicht.");
    const s = await loadStore(env);
    const thread = s.threads.find((t) => t.id === replyMatch[1]);
    if (!thread) return bad("thread nicht gefunden.", 404);
    const reply = {
      id: nanoid(10),
      nickname,
      body: text,
      createdAt: new Date().toISOString(),
    };
    thread.replies = thread.replies || [];
    thread.replies.push(reply);
    await saveStore(env, s);
    return json({ reply }, 201);
  }

  if (path === "/api/listings" && method === "GET") {
    const listings = [...(await loadStore(env)).listings].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return json({ listings });
  }

  if (path === "/api/listings" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const title = cleanText(body?.title, 120);
    const description = cleanText(body?.description, 800);
    const category = cleanText(body?.category, 40) || "sonstiges";
    const price = cleanText(body?.price, 40);
    if (!title || !description || !price) return bad("title, description und price sind Pflicht.");
    const listing = {
      id: nanoid(10),
      title,
      description,
      category,
      price,
      status: "aktiv",
      createdAt: new Date().toISOString(),
    };
    const s = await loadStore(env);
    s.listings.push(listing);
    await saveStore(env, s);
    return json({ listing }, 201);
  }

  const modMatch = path.match(/^\/api\/listings\/([^/]+)\/(flag|remove|restore)$/);
  if (modMatch && method === "POST") {
    const statusMap = { flag: "geflaggt", remove: "entfernt", restore: "aktiv" };
    const s = await loadStore(env);
    const listing = s.listings.find((l) => l.id === modMatch[1]);
    if (!listing) return bad("listing nicht gefunden.", 404);
    listing.status = statusMap[modMatch[2]];
    await saveStore(env, s);
    return json({ listing });
  }

  return bad("not found", 404);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return bad(String(err?.message || err), 500);
      }
    }
    if (env.ASSETS) {
      const assetResp = await env.ASSETS.fetch(request);
      if (assetResp.status !== 404) return assetResp;
      // SPA fallback
      const indexReq = new Request(new URL("/index.html", url.origin), request);
      return env.ASSETS.fetch(indexReq);
    }
    return new Response("elysium-forum worker — assets missing", { status: 200 });
  },
};
