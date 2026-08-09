export const meta = { type: "links", label: "Link List" };

export function defaultSettings(){
  return { title: "", layout: "grid", links: [] };
}

function faviconServiceUrl(pageUrl){
  try{
    const u = new URL(pageUrl);
    return `https://www.google.com/s2/favicons?sz=64&domain=${u.hostname}`;
  }catch(e){
    return "";
  }
}

// Resolves the <img src> for a link's icon:
// - no override: favicon service looked up against the link's own URL (default)
// - override + "use as lookup URL": favicon service looked up against the override URL instead
// - override + not a lookup URL: the override is used directly as the image URL
function resolveFaviconSrc(link){
  const override = (link.faviconOverride || "").trim();
  if(!override) return faviconServiceUrl(link.url);
  return link.faviconIsServiceUrl ? faviconServiceUrl(override) : override;
}

export function renderSettingsForm(container, settings){
  const s = { ...defaultSettings(), ...settings, links: (settings.links || []).map(l => ({ ...l })) };

  container.innerHTML = `
    <label class="field">
      <span>Title (optional)</span>
      <input type="text" data-field="title" value="${escapeAttr(s.title)}" placeholder="Links">
    </label>
    <label class="field">
      <span>Layout</span>
      <select data-field="layout">
        <option value="grid" ${s.layout==="grid"?"selected":""}>Grid (icons)</option>
        <option value="list" ${s.layout==="list"?"selected":""}>List</option>
      </select>
    </label>
    <div class="field">
      <span>Links</span>
      <div class="repeat-list" data-list="links"></div>
      <button type="button" class="chrome-btn small add-row-btn" data-add-link>+ Add link</button>
    </div>
  `;

  const list = container.querySelector('[data-list="links"]');

  function addRow(link = { label: "", url: "", faviconOverride: "", faviconIsServiceUrl: false }){
    const row = document.createElement("div");
    row.className = "repeat-row link-repeat-row";
    row.innerHTML = `
      <div class="repeat-row-main">
        <input type="text" placeholder="Label" data-link-label value="${escapeAttr(link.label)}">
        <input type="url" placeholder="https://example.com" data-link-url value="${escapeAttr(link.url)}">
        <button type="button" class="remove-row-btn" data-remove title="Remove link">✕</button>
      </div>
      <div class="repeat-row-favicon">
        <input type="url" placeholder="Custom favicon URL (optional — defaults to auto-lookup)" data-link-favicon value="${escapeAttr(link.faviconOverride || "")}">
        <label class="favicon-toggle">
          <input type="checkbox" data-link-favicon-service ${link.faviconIsServiceUrl ? "checked" : ""}>
          <span>Use as lookup URL, not image</span>
        </label>
      </div>
    `;
    row.querySelector("[data-remove]").addEventListener("click", () => row.remove());
    list.appendChild(row);
  }

  s.links.forEach(addRow);
  container.querySelector("[data-add-link]").addEventListener("click", () => addRow());
}

export function collectSettings(container){
  const title = container.querySelector('[data-field="title"]').value.trim();
  const layout = container.querySelector('[data-field="layout"]').value;
  const rows = [...container.querySelectorAll(".repeat-row")];
  const links = rows.map(row => ({
    label: row.querySelector("[data-link-label]").value.trim(),
    url: row.querySelector("[data-link-url]").value.trim(),
    faviconOverride: row.querySelector("[data-link-favicon]").value.trim(),
    faviconIsServiceUrl: row.querySelector("[data-link-favicon-service]").checked
  })).filter(l => l.url);
  return { title, layout, links };
}

export function mount(el, widget){
  const s = { ...defaultSettings(), ...widget.settings };
  el.classList.add("w-links");

  const titleHtml = s.title ? `<div class="links-title">${escapeHtml(s.title)}</div>` : "";
  const containerClass = s.layout === "list" ? "link-list" : "link-grid";
  const itemsHtml = s.links.map(l => `
    <a class="link-item" href="${escapeAttr(l.url)}" target="_blank" rel="noopener noreferrer">
      <img src="${escapeAttr(resolveFaviconSrc(l))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <span>${escapeHtml(l.label || hostnameOf(l.url))}</span>
    </a>
  `).join("");

  el.innerHTML = `${titleHtml}<div class="${containerClass}">${itemsHtml || '<p style="font-size:12px;color:rgba(255,255,255,0.5);">No links yet — edit this widget to add some.</p>'}</div>`;

  return { destroy(){} };
}

function hostnameOf(url){
  try{ return new URL(url).hostname; }catch(e){ return url; }
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
