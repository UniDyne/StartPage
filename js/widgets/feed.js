export const meta = { type: "feed", label: "RSS / Atom Feed" };

const PROXY_URL = "https://feed-json-proxy.unidyne.workers.dev/";
const CACHE_TTL_MS = 15 * 60 * 1000;

export function defaultSettings(){
  return { url: "", title: "", maxItems: 6, cache: null };
}

export function renderSettingsForm(container, settings){
  const s = { ...defaultSettings(), ...settings };
  container.innerHTML = `
    <label class="field">
      <span>Feed URL</span>
      <input type="url" data-field="url" value="${escapeAttr(s.url)}" placeholder="https://example.com/feed.xml">
    </label>
    <label class="field">
      <span>Title override (optional)</span>
      <input type="text" data-field="title" value="${escapeAttr(s.title)}" placeholder="Uses feed title if blank">
    </label>
    <label class="field">
      <span>Max items</span>
      <input type="number" data-field="maxItems" min="1" max="20" value="${s.maxItems}">
    </label>
    <input type="hidden" data-field="cache" value='${escapeAttr(JSON.stringify(s.cache))}'>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);">
      Feeds are fetched through a JSON proxy service so RSS/Atom feeds load reliably regardless of the source server's CORS policy. Results are cached and refresh at most every 15 minutes.
    </p>
  `;
}

export function collectSettings(container){
  const url = container.querySelector('[data-field="url"]').value.trim();
  const title = container.querySelector('[data-field="title"]').value.trim();
  const maxItems = Math.max(1, Math.min(20, parseInt(container.querySelector('[data-field="maxItems"]').value, 10) || 6));
  const cache = JSON.parse(container.querySelector('[data-field="cache"]').value || "null");
  return { url, title, maxItems, cache };
}

export function mount(el, widget, ctx){
  const s = { ...defaultSettings(), ...widget.settings };
  el.classList.add("w-feed");
  el.innerHTML = `<div class="feed-title"><span>${escapeHtml(s.title || "Feed")}</span></div><div class="feed-list">Loading…</div>`;
  const listEl = el.querySelector(".feed-list");
  const titleEl = el.querySelector(".feed-title span");

  let cancelled = false;

  if(!s.url){
    listEl.innerHTML = `<div class="feed-error">No feed URL configured — edit this widget to add one.</div>`;
    return { destroy(){} };
  }

  function render(parsed){
    if(!s.title && parsed.title) titleEl.textContent = parsed.title;
    if(!parsed.items.length){
      listEl.innerHTML = `<div class="feed-error">No items found in feed.</div>`;
      return;
    }
    listEl.innerHTML = parsed.items.slice(0, s.maxItems).map(item => `
      <a class="feed-item" href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer">
        <div class="feed-item-title">${escapeHtml(item.title)}</div>
        ${item.date ? `<div class="feed-item-date">${escapeHtml(item.date)}</div>` : ""}
      </a>
    `).join("");
  }

  const cache = s.cache;
  const isCacheValid = cache && cache.url === s.url;
  const isCacheFresh = isCacheValid && (Date.now() - cache.fetchedAt < CACHE_TTL_MS);

  if(isCacheFresh){
    render({ title: cache.title, items: cache.items });
    return { destroy(){} };
  }

  if(isCacheValid){
    // stale but usable: show it immediately while a fresh copy loads in the background
    render({ title: cache.title, items: cache.items });
  }

  (async () => {
    try{
      const res = await fetch(PROXY_URL, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: s.url })
      });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if(cancelled) return;
      if(data && data.error) throw new Error(data.error);
      const parsed = normalizeFeedJson(data);
      render(parsed);
      if(ctx && ctx.onSettingsChange){
        ctx.onSettingsChange({
          ...s,
          cache: { url: s.url, fetchedAt: Date.now(), title: parsed.title, items: parsed.items }
        });
      }
    }catch(e){
      if(cancelled) return;
      if(!isCacheValid){
        listEl.innerHTML = `<div class="feed-error">Couldn't load feed (${escapeHtml(e.message)}).</div>`;
      }
      // if stale cache is already showing, leave it up rather than replacing it with an error
    }
  })();

  return { destroy(){ cancelled = true; } };
}

// Normalizes the proxy's JSON response into { title, items:[{title,link,date}] }.
// Tolerates a few common field-naming conventions (JSON Feed-style and generic
// RSS/Atom-to-JSON conversions) since the exact proxy schema may vary by feed.
function normalizeFeedJson(data){
  const feed = data && data.feed ? data.feed : data || {};
  const title = feed.title || "";
  const rawItems = feed.items || feed.entries || [];

  const items = rawItems.map(item => {
    const link = item.url || item.link || item.href || "";
    const dateStr = item.date_published || item.pubDate || item.published || item.updated || item.date || "";
    return {
      title: (typeof item.title === "string" ? item.title : item.title && item.title.value) || "(untitled)",
      link,
      date: formatDate(dateStr)
    };
  });

  return { title, items };
}

function formatDate(dateStr){
  if(!dateStr) return "";
  const d = new Date(dateStr);
  if(isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
function escapeAttr(str){
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
