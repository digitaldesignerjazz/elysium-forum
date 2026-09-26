(() => {
  const cfg = window.ELYSIUM_CONFIG || {};
  const API = (cfg.apiBase || "").replace(/\/$/, "");

  const nickKey = "elysium_nickname";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function toast(msg, isErr = false) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.toggle("err", !!isErr);
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 3200);
  }

  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("de-DE", {
        timeZone: "Europe/Berlin",
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  async function api(path, opts = {}) {
    const url = `${API}${path}`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      throw new Error((data && data.error) || `http ${res.status}`);
    }
    return data;
  }

  function rememberNick(form) {
    const input = form.querySelector('[name="nickname"]');
    if (!input) return;
    const saved = localStorage.getItem(nickKey);
    if (saved && !input.value) input.value = saved;
    form.addEventListener("submit", () => {
      if (input.value.trim()) localStorage.setItem(nickKey, input.value.trim());
    });
  }

  /* tabs */
  $$(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      const tab = btn.dataset.tab;
      $("#panel-forum").classList.toggle("hidden", tab !== "forum");
      $("#panel-market").classList.toggle("hidden", tab !== "market");
      if (tab === "forum") loadThreads();
      if (tab === "market") loadListings();
    });
  });

  /* forum list */
  async function loadThreads() {
    try {
      const { threads } = await api("/api/threads");
      const box = $("#threads");
      box.innerHTML = "";
      $("#thread-count").textContent = `${threads.length} threads`;
      $("#threads-empty").classList.toggle("hidden", threads.length > 0);
      for (const t of threads) {
        const el = document.createElement("article");
        el.className = "thread-card";
        el.setAttribute("role", "listitem");
        el.innerHTML = `
          <h3></h3>
          <div class="meta">
            <span>@${escapeHtml(t.nickname)}</span>
            <span>${fmtTime(t.createdAt)} CET/CEST</span>
            <span>${t.replyCount} replies</span>
          </div>
          <p class="preview"></p>`;
        el.querySelector("h3").textContent = t.title;
        el.querySelector(".preview").textContent = t.preview || "";
        el.addEventListener("click", () => openThread(t.id));
        box.appendChild(el);
      }
    } catch (err) {
      toast("threads laden fehlgeschlagen: " + err.message, true);
    }
  }

  $("#thread-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await api("/api/threads", {
        method: "POST",
        body: JSON.stringify({
          nickname: fd.get("nickname"),
          title: fd.get("title"),
          body: fd.get("body"),
        }),
      });
      e.target.reset();
      rememberNick(e.target);
      toast("thread erstellt");
      loadThreads();
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  /* thread detail */
  let currentThreadId = null;

  async function openThread(id) {
    currentThreadId = id;
    $("#forum-list-view").classList.add("hidden");
    $("#forum-thread-view").classList.remove("hidden");
    try {
      const { thread } = await api(`/api/threads/${id}`);
      const detail = $("#thread-detail");
      detail.innerHTML = `
        <h2></h2>
        <div class="meta">
          <span>@${escapeHtml(thread.nickname)}</span>
          <span>${fmtTime(thread.createdAt)} CET/CEST</span>
        </div>
        <div class="thread-body"></div>
        <h3 style="margin:1rem 0 0.5rem;font-size:0.95rem;color:var(--accent)">replies (${(thread.replies||[]).length})</h3>
        <div class="replies"></div>`;
      detail.querySelector("h2").textContent = thread.title;
      detail.querySelector(".thread-body").textContent = thread.body;
      const replies = detail.querySelector(".replies");
      for (const r of thread.replies || []) {
        const div = document.createElement("div");
        div.className = "reply";
        div.innerHTML = `<div class="meta"><span>@${escapeHtml(r.nickname)}</span><span>${fmtTime(r.createdAt)} CET/CEST</span></div><p class="body"></p>`;
        div.querySelector(".body").textContent = r.body;
        replies.appendChild(div);
      }
    } catch (err) {
      toast(err.message, true);
      closeThread();
    }
  }

  function closeThread() {
    currentThreadId = null;
    $("#forum-thread-view").classList.add("hidden");
    $("#forum-list-view").classList.remove("hidden");
    loadThreads();
  }

  $("#btn-back").addEventListener("click", closeThread);

  $("#reply-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentThreadId) return;
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await api(`/api/threads/${currentThreadId}/replies`, {
        method: "POST",
        body: JSON.stringify({
          nickname: fd.get("nickname"),
          body: fd.get("body"),
        }),
      });
      e.target.reset();
      rememberNick(e.target);
      toast("antwort gepostet");
      openThread(currentThreadId);
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  /* marketplace */
  async function loadListings() {
    const filter = $("#status-filter").value;
    try {
      const { listings } = await api("/api/listings");
      const filtered =
        filter === "all" ? listings : listings.filter((l) => l.status === filter);
      const box = $("#listings");
      box.innerHTML = "";
      $("#listing-count").textContent = `${filtered.length} / ${listings.length}`;
      $("#listings-empty").classList.toggle("hidden", filtered.length > 0);
      for (const l of filtered) {
        const el = document.createElement("article");
        el.className = "listing-card";
        el.setAttribute("role", "listitem");
        el.innerHTML = `
          <div class="meta">
            <span class="badge ${escapeHtml(l.status)}">${escapeHtml(l.status)}</span>
            <span>${escapeHtml(l.category)}</span>
            <span>${escapeHtml(l.price)}</span>
            <span>${fmtTime(l.createdAt)} CET/CEST</span>
          </div>
          <h3></h3>
          <p class="desc"></p>
          <div class="listing-actions">
            <button type="button" class="btn warn" data-act="flag">flaggen</button>
            <button type="button" class="btn danger" data-act="remove">entfernen</button>
            <button type="button" class="btn ok" data-act="restore">wiederherstellen</button>
          </div>`;
        el.querySelector("h3").textContent = l.title;
        el.querySelector(".desc").textContent = l.description;
        el.querySelectorAll("[data-act]").forEach((btn) => {
          btn.addEventListener("click", () => modAction(l.id, btn.dataset.act));
        });
        box.appendChild(el);
      }
    } catch (err) {
      toast("listings laden fehlgeschlagen: " + err.message, true);
    }
  }

  async function modAction(id, act) {
    const map = { flag: "flag", remove: "remove", restore: "restore" };
    try {
      await api(`/api/listings/${id}/${map[act]}`, { method: "POST", body: "{}" });
      toast("status aktualisiert");
      loadListings();
    } catch (err) {
      toast(err.message, true);
    }
  }

  $("#listing-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await api("/api/listings", {
        method: "POST",
        body: JSON.stringify({
          title: fd.get("title"),
          description: fd.get("description"),
          category: fd.get("category"),
          price: fd.get("price"),
        }),
      });
      e.target.reset();
      toast("listing erstellt");
      loadListings();
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  $("#status-filter").addEventListener("change", loadListings);

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function checkHealth() {
    const pill = $("#api-status");
    const footer = $("#footer-api");
    try {
      const h = await api("/api/health");
      pill.textContent = "api live";
      pill.className = "status-pill ok";
      footer.textContent = `api ${API || "(same-origin)"} · ${h.threads} threads · ${h.listings} listings · sync ${fmtTime(h.updatedAt)}`;
      return true;
    } catch (err) {
      pill.textContent = "api offline";
      pill.className = "status-pill err";
      footer.textContent = `api ${API || "(same-origin)"} · offline: ${err.message}`;
      return false;
    }
  }

  rememberNick($("#thread-form"));
  rememberNick($("#reply-form"));

  (async () => {
    // If config points elsewhere but we're on the tunnel, prefer same-origin when health works locally
    const ok = await checkHealth();
    if (!ok && cfg.apiBase) {
      // already failed against configured base
    }
    await loadThreads();
  })();
})();
