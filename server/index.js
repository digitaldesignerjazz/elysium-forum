import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import { initStore, getStore, mutate } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const PUBLIC = path.join(__dirname, "..", "public");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "256kb" }));
app.use(express.static(PUBLIC));

function bad(res, code, msg) {
  return res.status(code).json({ error: msg });
}

function cleanText(s, max) {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

app.get("/api/health", (_req, res) => {
  const s = getStore();
  res.json({
    ok: true,
    service: "elysium-forum",
    threads: s.threads.length,
    listings: s.listings.length,
    updatedAt: s.updatedAt,
  });
});

app.get("/api/threads", (_req, res) => {
  const threads = getStore().threads
    .map((t) => ({
      id: t.id,
      title: t.title,
      nickname: t.nickname,
      createdAt: t.createdAt,
      replyCount: (t.replies || []).length,
      preview: (t.body || "").slice(0, 140),
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ threads });
});

app.post("/api/threads", (req, res) => {
  const nickname = cleanText(req.body?.nickname, 40);
  const title = cleanText(req.body?.title, 120);
  const body = cleanText(req.body?.body, 4000);
  if (!nickname || !title || !body) {
    return bad(res, 400, "nickname, title und body sind Pflicht.");
  }
  const thread = {
    id: nanoid(10),
    nickname,
    title,
    body,
    createdAt: new Date().toISOString(),
    replies: [],
  };
  mutate((s) => {
    s.threads.push(thread);
  });
  res.status(201).json({ thread });
});

app.get("/api/threads/:id", (req, res) => {
  const thread = getStore().threads.find((t) => t.id === req.params.id);
  if (!thread) return bad(res, 404, "thread nicht gefunden.");
  res.json({ thread });
});

app.post("/api/threads/:id/replies", (req, res) => {
  const nickname = cleanText(req.body?.nickname, 40);
  const body = cleanText(req.body?.body, 4000);
  if (!nickname || !body) return bad(res, 400, "nickname und body sind Pflicht.");
  let reply = null;
  let found = false;
  mutate((s) => {
    const thread = s.threads.find((t) => t.id === req.params.id);
    if (!thread) return;
    found = true;
    reply = {
      id: nanoid(10),
      nickname,
      body,
      createdAt: new Date().toISOString(),
    };
    thread.replies = thread.replies || [];
    thread.replies.push(reply);
  });
  if (!found) return bad(res, 404, "thread nicht gefunden.");
  res.status(201).json({ reply });
});

app.get("/api/listings", (_req, res) => {
  const listings = [...getStore().listings].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json({ listings });
});

app.post("/api/listings", (req, res) => {
  const title = cleanText(req.body?.title, 120);
  const description = cleanText(req.body?.description, 800);
  const category = cleanText(req.body?.category, 40) || "sonstiges";
  const price = cleanText(req.body?.price, 40);
  if (!title || !description || !price) {
    return bad(res, 400, "title, description und price sind Pflicht.");
  }
  const listing = {
    id: nanoid(10),
    title,
    description,
    category,
    price,
    status: "aktiv",
    createdAt: new Date().toISOString(),
  };
  mutate((s) => {
    s.listings.push(listing);
  });
  res.status(201).json({ listing });
});

function setListingStatus(id, status) {
  let listing = null;
  mutate((s) => {
    const item = s.listings.find((l) => l.id === id);
    if (!item) return;
    item.status = status;
    listing = item;
  });
  return listing;
}

app.post("/api/listings/:id/flag", (req, res) => {
  const listing = setListingStatus(req.params.id, "geflaggt");
  if (!listing) return bad(res, 404, "listing nicht gefunden.");
  res.json({ listing });
});

app.post("/api/listings/:id/remove", (req, res) => {
  const listing = setListingStatus(req.params.id, "entfernt");
  if (!listing) return bad(res, 404, "listing nicht gefunden.");
  res.json({ listing });
});

app.post("/api/listings/:id/restore", (req, res) => {
  const listing = setListingStatus(req.params.id, "aktiv");
  if (!listing) return bad(res, 404, "listing nicht gefunden.");
  res.json({ listing });
});

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(PUBLIC, "index.html"));
});

await initStore();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[elysium-forum] listening on http://0.0.0.0:${PORT}`);
});
