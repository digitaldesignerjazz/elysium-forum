/**
 * Cloudflare Worker + KV backend for elysium-forum.
 * Deploy after: wrangler login && wrangler kv namespace create STORE
 * Free CF account is enough (no credit card for Workers free tier).
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("elysium-forum worker — mount assets or use pages", { status: 200 });
    }
    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "elysium-forum-worker", note: "deploy + bind KV to activate" });
    }
    return json({ error: "worker stub — use box tunnel api until wrangler login" }, 501);
  },
};
