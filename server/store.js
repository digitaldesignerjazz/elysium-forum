import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { SEED_LISTINGS, SEED_THREADS } from "./seed.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const REPO = process.env.ELYSIUM_REPO || "digitaldesignerjazz/elysium-forum";
const GH_PATH = "data/store.json";

function emptyStore() {
  return {
    threads: [],
    listings: [],
    updatedAt: new Date().toISOString(),
  };
}

let store = emptyStore();
let writeChain = Promise.resolve();
let githubSha = null;

async function readLocal() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeLocal(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function ghApi(args, input) {
  const opts = {
    maxBuffer: 10 * 1024 * 1024,
    env: process.env,
  };
  if (input !== undefined) {
    opts.input = typeof input === "string" ? input : JSON.stringify(input);
  }
  const { stdout } = await execFileAsync("gh", ["api", ...args], opts);
  return stdout ? JSON.parse(stdout) : null;
}

async function pullFromGithub() {
  try {
    const meta = await ghApi([
      `repos/${REPO}/contents/${GH_PATH}`,
      "--jq",
      "{sha: .sha, content: .content}",
    ]);
    if (!meta?.content) return null;
    githubSha = meta.sha;
    const json = Buffer.from(meta.content, "base64").toString("utf8");
    return JSON.parse(json);
  } catch (err) {
    // 404 or network — ignore
    return null;
  }
}

async function pushToGithub(data) {
  try {
    const content = Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf8").toString("base64");
    const body = {
      message: `chore: sync store ${data.updatedAt}`,
      content,
      branch: "main",
    };
    if (githubSha) body.sha = githubSha;
    const result = await ghApi(
      ["--method", "PUT", `repos/${REPO}/contents/${GH_PATH}`, "--input", "-"],
      body
    );
    githubSha = result?.content?.sha || githubSha;
  } catch (err) {
    console.error("[store] github push failed:", err.message || err);
  }
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

export async function initStore() {
  const local = await readLocal();
  const remote = await pullFromGithub();

  // Prefer newer updatedAt
  let chosen = emptyStore();
  if (local && remote) {
    chosen =
      new Date(local.updatedAt || 0) >= new Date(remote.updatedAt || 0)
        ? local
        : remote;
  } else if (local) {
    chosen = local;
  } else if (remote) {
    chosen = remote;
  }

  const seeded = ensureSeed(chosen);
  chosen.updatedAt = chosen.updatedAt || new Date().toISOString();
  store = chosen;
  await writeLocal(store);
  if (seeded || !remote) {
    await pushToGithub(store);
  }
  console.log(
    `[store] ready — ${store.threads.length} threads, ${store.listings.length} listings`
  );
  return store;
}

function schedulePersist() {
  writeChain = writeChain
    .then(async () => {
      store.updatedAt = new Date().toISOString();
      await writeLocal(store);
      await pushToGithub(store);
    })
    .catch((err) => console.error("[store] persist error:", err));
  return writeChain;
}

export function getStore() {
  return store;
}

export function mutate(fn) {
  const result = fn(store);
  schedulePersist();
  return result;
}
