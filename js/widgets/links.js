export const meta = { type: "links", label: "Link List" };

// Drag-and-drop state is shared at module scope (not per-instance) so a link
// can be dragged out of one mounted Links widget and dropped into another —
// each mount() registers itself here so drags can look up any widget's data.
let dragState = null; // { widgetId, id }
const instances = new Map(); // widgetId -> { getLink, removeLink, reconcileOrder }

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
  const s = { ...defaultSettings(), ...settings, links: (settings.links || []).map(l => ({ ...l, id: l.id || uid() })) };

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

  function addRow(link = { id: uid(), label: "", url: "", faviconOverride: "", faviconIsServiceUrl: false }){
    const row = document.createElement("div");
    row.className = "repeat-row link-repeat-row";
    row.dataset.linkId = link.id;
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
    id: row.dataset.linkId || uid(),
    label: row.querySelector("[data-link-label]").value.trim(),
    url: row.querySelector("[data-link-url]").value.trim(),
    faviconOverride: row.querySelector("[data-link-favicon]").value.trim(),
    faviconIsServiceUrl: row.querySelector("[data-link-favicon-service]").checked
  })).filter(l => l.url);
  return { title, layout, links };
}

export function mount(el, widget, ctx){
  const s = { ...defaultSettings(), ...widget.settings, links: (widget.settings.links || []).map(l => ({ ...l, id: l.id || uid() })) };
  el.classList.add("w-links");

  const titleHtml = s.title ? `<div class="links-title">${escapeHtml(s.title)}</div>` : "";
  el.innerHTML = titleHtml;

  const containerEl = document.createElement("div");
  containerEl.className = s.layout === "list" ? "link-list" : "link-grid";
  containerEl.dataset.widgetId = widget.id;
  el.appendChild(containerEl);

  // Backfill ids for links stored before drag-and-drop needed a stable id per link.
  const storedLinks = widget.settings.links || [];
  if(s.links.some((l, i) => l.id !== (storedLinks[i] && storedLinks[i].id))){
    persist();
  }

  function persist(){
    ctx.onSettingsChange({ title: s.title, layout: s.layout, links: s.links });
  }

  function buildLinkNode(link){
    const a = document.createElement("a");
    a.className = "link-item";
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.draggable = true;
    a.dataset.id = link.id;

    const img = document.createElement("img");
    img.src = resolveFaviconSrc(link);
    img.alt = "";
    img.loading = "lazy";
    img.draggable = false;
    img.addEventListener("error", () => { img.style.visibility = "hidden"; });

    const span = document.createElement("span");
    span.textContent = link.label || hostnameOf(link.url);

    a.appendChild(img);
    a.appendChild(span);

    a.addEventListener("dragstart", e => {
      dragState = { widgetId: widget.id, id: link.id };
      a.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", link.id);
    });
    a.addEventListener("dragend", () => {
      a.classList.remove("dragging");
      clearDragOverStyling();
      finalizeDrag(a);
      dragState = null;
    });

    return a;
  }

  function renderList(){
    containerEl.innerHTML = "";
    if(!s.links.length){
      const empty = document.createElement("p");
      empty.className = "link-empty";
      empty.style.cssText = "font-size:12px;color:rgba(255,255,255,0.5);";
      empty.textContent = "No links yet — edit this widget to add some.";
      containerEl.appendChild(empty);
      return;
    }
    s.links.forEach(link => containerEl.appendChild(buildLinkNode(link)));
  }

  containerEl.addEventListener("dragover", e => {
    if(!dragState) return;
    e.preventDefault();
    const dragEl = document.querySelector(".link-item.dragging");
    if(!dragEl) return;
    const emptyMsg = containerEl.querySelector(".link-empty");
    if(emptyMsg) emptyMsg.remove();
    clearDragOverStyling();
    containerEl.classList.add("drag-over");
    const afterEl = getDragAfterElement(containerEl, e.clientX, e.clientY);
    if(afterEl == null){
      containerEl.appendChild(dragEl);
    }else{
      containerEl.insertBefore(dragEl, afterEl);
    }
  });
  containerEl.addEventListener("drop", e => {
    e.preventDefault();
  });

  // A link dropped into an empty widget (or emptied by dragging its only
  // link out) needs the placeholder message restored / re-removed.
  function ensureEmptyState(){
    if(s.links.length || containerEl.querySelector(".link-item") || containerEl.querySelector(".link-empty")) return;
    renderList();
  }

  function finalizeDrag(dragEl){
    if(!dragState) return;
    const targetContainer = dragEl.closest(".link-grid, .link-list");
    if(!targetContainer) return;
    const targetWidgetId = targetContainer.dataset.widgetId;
    const targetApi = instances.get(targetWidgetId);
    if(!targetApi) return;
    const ids = [...targetContainer.querySelectorAll(".link-item")].map(n => n.dataset.id);

    if(dragState.widgetId === targetWidgetId){
      targetApi.reconcileOrder(ids);
    }else{
      const sourceApi = instances.get(dragState.widgetId);
      const movedLink = sourceApi ? sourceApi.getLink(dragState.id) : null;
      if(sourceApi) sourceApi.removeLink(dragState.id);
      targetApi.reconcileOrder(ids, movedLink);
    }
  }

  instances.set(widget.id, {
    getLink(id){ return s.links.find(l => l.id === id); },
    removeLink(id){
      s.links = s.links.filter(l => l.id !== id);
      persist();
      ensureEmptyState();
    },
    reconcileOrder(ids, extraLink){
      const byId = new Map(s.links.map(l => [l.id, l]));
      if(extraLink) byId.set(extraLink.id, extraLink);
      s.links = ids.map(id => byId.get(id)).filter(Boolean);
      persist();
    }
  });

  renderList();

  return { destroy(){ instances.delete(widget.id); } };
}

function clearDragOverStyling(){
  document.querySelectorAll(".link-grid.drag-over, .link-list.drag-over").forEach(el => el.classList.remove("drag-over"));
}

// Picks the element the dragged item should be inserted before, using both
// axes so it behaves for a wrapping icon grid as well as a single-column list.
function getDragAfterElement(container, x, y){
  const els = [...container.querySelectorAll(".link-item:not(.dragging)")];
  let closest = { distance: Infinity, element: null };
  for(const child of els){
    const box = child.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const isBefore = y < box.top || (y < box.bottom && x < cx);
    if(!isBefore) continue;
    const dx = x - cx, dy = y - cy;
    const dist = dx * dx + dy * dy;
    if(dist < closest.distance) closest = { distance: dist, element: child };
  }
  return closest.element;
}

function uid(){
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
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
