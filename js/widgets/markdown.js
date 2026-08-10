export const meta = { type: "markdown", label: "Markdown" };

const READABILITY_PROXY_URL = "https://readability-markdown-proxy.unidyne.workers.dev/";

const EYE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

export function defaultSettings(){
  return { items: [] };
}

// Older versions of this widget stored a single { title, body, sourceUrl } article
// directly on the widget. Fold that into a one-item list so existing widgets don't
// silently lose their content when this settings shape loads.
function normalizeSettings(settings){
  if(settings && Array.isArray(settings.items)) return settings;
  if(settings && (settings.body || settings.title)){
    return { items: [{ id: uid(), title: settings.title || "", body: settings.body || "", sourceUrl: settings.sourceUrl || "" }] };
  }
  return defaultSettings();
}

export function renderSettingsForm(container, settings){
  const s = normalizeSettings(settings);
  container.innerHTML = `
    <input type="hidden" data-field="items" value='${escapeAttr(JSON.stringify(s.items))}'>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);">Add, read, and remove articles directly on the widget itself using the + button in its title bar.</p>
  `;
}

export function collectSettings(container){
  const items = JSON.parse(container.querySelector('[data-field="items"]').value || "[]");
  return { items };
}

export function mount(el, widget, ctx){
  const s = normalizeSettings(widget.settings);
  s.items = s.items.map(i => ({ ...i }));
  el.classList.add("w-markdown");

  const listEl = document.createElement("ul");
  listEl.className = "md-item-list";
  el.appendChild(listEl);

  let overlay = null;

  function closeOverlay(){
    if(!overlay) return;
    overlay.remove();
    document.removeEventListener("keydown", onKeydown);
    overlay = null;
  }

  function onKeydown(e){
    if(e.key === "Escape") closeOverlay();
  }

  function showOverlay(innerHtml, wire){
    closeOverlay();
    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal modal-lightbox">${innerHtml}</div>`;
    overlay.addEventListener("click", e => {
      if(e.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", onKeydown);
    document.body.appendChild(overlay);
    wire(overlay);
  }

  function persist(){
    ctx.onSettingsChange({ items: s.items });
  }

  function renderList(){
    if(!s.items.length){
      listEl.innerHTML = `<li class="md-item-empty">No articles yet — use the + above to add one.</li>`;
      return;
    }
    listEl.innerHTML = s.items.map(item => `
      <li class="md-item-row" data-id="${item.id}">
        <button type="button" class="md-item-open" title="Read">${EYE_ICON}<span class="md-item-title">${escapeHtml(deriveItemTitle(item))}</span></button>
        <button type="button" class="icon-btn md-item-remove" title="Remove">✕</button>
      </li>
    `).join("");

    listEl.querySelectorAll(".md-item-row").forEach(row => {
      const id = row.dataset.id;
      row.querySelector(".md-item-open").addEventListener("click", () => {
        const item = s.items.find(i => i.id === id);
        if(item) openReadOverlay(item);
      });
      row.querySelector(".md-item-remove").addEventListener("click", () => {
        s.items = s.items.filter(i => i.id !== id);
        renderList();
        persist();
      });
    });
  }

  function openReadOverlay(item){
    showOverlay(`
      <div class="modal-header">
        <h2>${escapeHtml(deriveItemTitle(item))}</h2>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <div class="md-body">${renderMarkdown(item.body) || '<p style="color:rgba(255,255,255,0.5);">No content.</p>'}</div>
      </div>
    `, (root) => {
      root.querySelector("[data-close]").addEventListener("click", closeOverlay);
    });
  }

  function openAddOverlay(){
    showOverlay(`
      <div class="modal-header">
        <h2>Add article</h2>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <label class="field">
          <span>Title</span>
          <input type="text" data-add-title placeholder="Article title">
        </label>
        <label class="field">
          <span>Fetch content from a URL (optional)</span>
          <div class="repeat-row">
            <input type="url" data-add-source-url placeholder="https://example.com/article">
            <button type="button" class="chrome-btn small" data-add-fetch>Fetch</button>
          </div>
          <p data-add-fetch-status style="font-size:11px;color:rgba(255,255,255,0.5);"></p>
        </label>
        <label class="field">
          <span>Markdown content</span>
          <textarea data-add-body rows="10" placeholder="# Heading&#10;&#10;Some **bold** text and a [link](https://example.com)"></textarea>
        </label>
      </div>
      <div class="modal-footer">
        <button type="button" class="chrome-btn" data-close>Cancel</button>
        <button type="button" class="chrome-btn primary" data-add-save>Add article</button>
      </div>
    `, (root) => {
      const titleInput = root.querySelector("[data-add-title]");
      const urlInput = root.querySelector("[data-add-source-url]");
      const bodyInput = root.querySelector("[data-add-body]");
      const fetchBtn = root.querySelector("[data-add-fetch]");
      const statusEl = root.querySelector("[data-add-fetch-status]");

      root.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", closeOverlay));

      fetchBtn.addEventListener("click", async () => {
        const url = urlInput.value.trim();
        if(!url){
          statusEl.textContent = "Enter a URL first.";
          return;
        }
        fetchBtn.disabled = true;
        fetchBtn.textContent = "Fetching…";
        statusEl.textContent = "";
        try{
          const res = await fetch(READABILITY_PROXY_URL, {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
          });
          const data = await res.json().catch(() => null);
          if(!res.ok || !data || data.error) throw new Error((data && data.error) || `HTTP ${res.status}`);
          bodyInput.value = data.markdown || "";
          statusEl.textContent = "Content fetched — review below, then Add article.";
        }catch(e){
          statusEl.textContent = `Couldn't fetch that page (${e.message}).`;
        }finally{
          fetchBtn.disabled = false;
          fetchBtn.textContent = "Fetch";
        }
      });

      root.querySelector("[data-add-save]").addEventListener("click", () => {
        const title = titleInput.value.trim();
        const body = bodyInput.value;
        const sourceUrl = urlInput.value.trim();
        if(!title && !body){
          statusEl.textContent = "Add a title or some content first.";
          return;
        }
        s.items.push({ id: uid(), title, body, sourceUrl });
        renderList();
        persist();
        closeOverlay();
      });
    });
  }

  if(ctx && ctx.headActions){
    const addBtn = document.createElement("button");
    addBtn.className = "icon-btn";
    addBtn.title = "Add article";
    addBtn.setAttribute("aria-label", "Add article");
    addBtn.innerHTML = PLUS_ICON;
    addBtn.addEventListener("click", openAddOverlay);
    ctx.headActions.insertBefore(addBtn, ctx.headActions.firstChild);
  }

  renderList();

  return { destroy(){ closeOverlay(); } };
}

function deriveItemTitle(item){
  if(item.title) return item.title;
  const firstLine = (item.body || "").split(/\r?\n/).find(l => l.trim());
  if(firstLine) return firstLine.replace(/^#+\s*/, "").trim().slice(0, 80);
  return "Untitled";
}

function uid(){
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Markdown subset: headings (h1-h6), fenced code blocks, images, links, bold,
// italic, strikethrough, inline code, ordered/unordered lists, blockquotes,
// horizontal rules, paragraphs. Not a full CommonMark implementation (no
// nested blocks, tables, or indented code) but covers what readability-extracted
// articles and hand-written notes typically use.
function renderMarkdown(src){
  if(!src) return "";
  const escaped = escapeHtml(src);
  const lines = escaped.split(/\r?\n/);
  const htmlLines = [];
  let blockState = null; // null | "ul" | "ol" | "blockquote"
  let inFence = false;

  function closeBlock(){
    if(blockState === "ul") htmlLines.push("</ul>");
    else if(blockState === "ol") htmlLines.push("</ol>");
    else if(blockState === "blockquote") htmlLines.push("</blockquote>");
    blockState = null;
  }

  for(const line of lines){
    const fenceMatch = /^```\s*([\w-]*)\s*$/.exec(line);
    if(fenceMatch){
      if(inFence){
        htmlLines.push("</code></pre>");
        inFence = false;
      }else{
        closeBlock();
        const lang = fenceMatch[1];
        htmlLines.push(`<pre><code${lang ? ` class="language-${lang}"` : ""}>`);
        inFence = true;
      }
      continue;
    }
    if(inFence){
      htmlLines.push(line);
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    const hrMatch = /^(?:-{3,}|\*{3,}|_{3,})$/.exec(line.trim());
    const quoteMatch = /^&gt;\s?(.*)$/.exec(line);
    const olMatch = /^\d+\.\s+(.*)$/.exec(line);
    const ulMatch = /^[-*]\s+(.*)$/.exec(line);

    if(headingMatch){
      closeBlock();
      const level = headingMatch[1].length;
      htmlLines.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
      continue;
    }
    if(hrMatch){
      closeBlock();
      htmlLines.push("<hr>");
      continue;
    }
    if(quoteMatch){
      if(blockState !== "blockquote"){ closeBlock(); htmlLines.push("<blockquote>"); blockState = "blockquote"; }
      htmlLines.push(`<p>${inline(quoteMatch[1])}</p>`);
      continue;
    }
    if(olMatch){
      if(blockState !== "ol"){ closeBlock(); htmlLines.push("<ol>"); blockState = "ol"; }
      htmlLines.push(`<li>${inline(olMatch[1])}</li>`);
      continue;
    }
    if(ulMatch){
      if(blockState !== "ul"){ closeBlock(); htmlLines.push("<ul>"); blockState = "ul"; }
      htmlLines.push(`<li>${inline(ulMatch[1])}</li>`);
      continue;
    }

    closeBlock();
    if(line.trim() === ""){
      continue;
    }
    htmlLines.push(`<p>${inline(line)}</p>`);
  }

  if(inFence) htmlLines.push("</code></pre>");
  closeBlock();

  return htmlLines.join("\n");
}

// Only http(s) and protocol-relative URLs are linkified/embedded — this content
// can originate from arbitrary fetched web pages, so schemes like javascript:
// are deliberately excluded rather than passed through into href/src.
const SAFE_URL = "(?:https?:\\/\\/[^\\s)]+|\\/\\/[^\\s)]+)";
const IMAGE_RE = new RegExp(`!\\[([^\\]]*)\\]\\((${SAFE_URL})\\)`, "g");
const LINK_RE = new RegExp(`\\[([^\\]]+)\\]\\((${SAFE_URL})\\)`, "g");

function inline(text){
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(IMAGE_RE, '<img src="$2" alt="$1" loading="lazy">')
    .replace(LINK_RE, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
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
