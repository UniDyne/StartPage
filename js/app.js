import { loadConfig, saveConfig, uid, createPage, getActivePage, normalizeConfig } from "./storage.js";
import { registry, widgetTypes } from "./registry.js";
import { renderBoard } from "./render.js";

let config = loadConfig();
let activePage = getActivePage(config);

const board = document.getElementById("board");
const bgLayer = document.getElementById("bg-layer");
const toast = document.getElementById("toast");
const pageTitleEl = document.getElementById("page-title");

function applyTheme(){
  const root = document.documentElement;
  root.style.setProperty("--tint-color", activePage.theme.tintColor);
  root.style.setProperty("--tint-opacity", activePage.theme.tintOpacity);
  root.style.setProperty("--tint-blur", `${activePage.theme.tintBlur}px`);
  document.body.classList.toggle("theme-dark-text", activePage.theme.textMode === "dark");
  bgLayer.style.backgroundImage = activePage.background.value ? `url("${activePage.background.value}")` : "none";

  const name = (activePage.name || "").trim();
  pageTitleEl.textContent = name;
  pageTitleEl.classList.toggle("hidden", !name);
}

function renderAll(){
  renderBoard(activePage, board, { onEdit, onDelete, onReorder, onSettingsChange });
  renderPageSwitcher();
}

function persistAndRender(){
  saveConfig(config);
  renderAll();
}

function showToast(msg){
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 1800);
}

// ---------------- Pages ----------------

const pageTilesEl = document.getElementById("page-tiles");
const btnAddPage = document.getElementById("btn-add-page");
const btnDeletePage = document.getElementById("btn-delete-page");

function renderPageSwitcher(){
  pageTilesEl.innerHTML = config.pages.map(p => `
    <button class="page-tile ${p.id === activePage.id ? "active" : ""}"
      data-page-id="${p.id}"
      title="${escapeAttr(p.name)}"
      style="background-color: rgb(${p.theme.tintColor});"></button>
  `).join("");

  pageTilesEl.querySelectorAll(".page-tile").forEach(btn => {
    btn.addEventListener("click", () => switchPage(btn.dataset.pageId));
  });

  btnDeletePage.disabled = config.pages.length <= 1;
}

function switchPage(pageId){
  if(pageId === activePage.id) return;
  config.activePageId = pageId;
  activePage = getActivePage(config);
  saveConfig(config);
  applyTheme();
  renderAll();
}

btnAddPage.addEventListener("click", () => {
  const page = createPage({ name: `Page ${config.pages.length + 1}` });
  config.pages.push(page);
  config.activePageId = page.id;
  activePage = page;
  saveConfig(config);
  applyTheme();
  renderAll();
});

btnDeletePage.addEventListener("click", () => {
  if(config.pages.length <= 1) return;
  if(!confirm(`Delete "${activePage.name}"? This cannot be undone.`)) return;
  const idx = config.pages.findIndex(p => p.id === activePage.id);
  config.pages.splice(idx, 1);
  const nextIdx = Math.max(0, idx - 1);
  config.activePageId = config.pages[nextIdx].id;
  activePage = getActivePage(config);
  saveConfig(config);
  applyTheme();
  renderAll();
});

// ---------------- Widget CRUD ----------------

function onDelete(id){
  if(!confirm("Remove this widget?")) return;
  activePage.widgets = activePage.widgets.filter(w => w.id !== id);
  persistAndRender();
}

function onReorder(updates){
  const byId = new Map(activePage.widgets.map(w => [w.id, w]));
  updates.forEach(u => {
    const w = byId.get(u.id);
    if(w){ w.col = u.col; w.order = u.order; }
  });
  saveConfig(config);
  renderAll();
}

function onSettingsChange(id, newSettings){
  const widget = activePage.widgets.find(w => w.id === id);
  if(!widget) return;
  widget.settings = newSettings;
  saveConfig(config);
}

let editingId = null;

function onEdit(id){
  editingId = id;
  const widget = activePage.widgets.find(w => w.id === id);
  openWidgetModal(widget);
}

// ---------------- Widget modal ----------------

const modalWidget = document.getElementById("modal-widget");
const widgetModalTitle = document.getElementById("widget-modal-title");
const nameInput = document.getElementById("widget-name-input");
const typeSelect = document.getElementById("widget-type-select");
const typeFields = document.getElementById("widget-type-fields");
const saveBtn = document.getElementById("widget-modal-save");
const cancelBtn = document.getElementById("widget-modal-cancel");

typeSelect.innerHTML = widgetTypes.map(t => `<option value="${t.type}">${t.label}</option>`).join("");

function openWidgetModal(widget){
  widgetModalTitle.textContent = widget ? `Edit ${registry[widget.type].meta.label}` : "Add widget";
  nameInput.value = widget ? (widget.name || "") : "";
  typeSelect.value = widget ? widget.type : widgetTypes[0].type;
  typeSelect.disabled = !!widget;
  renderTypeFields();
  modalWidget.classList.remove("hidden");
}

function renderTypeFields(){
  const type = typeSelect.value;
  const mod = registry[type];
  const widget = editingId ? activePage.widgets.find(w => w.id === editingId) : null;
  const settings = widget ? widget.settings : mod.defaultSettings();
  mod.renderSettingsForm(typeFields, settings);
}

typeSelect.addEventListener("change", renderTypeFields);

cancelBtn.addEventListener("click", closeWidgetModal);
function closeWidgetModal(){
  modalWidget.classList.add("hidden");
  editingId = null;
}

saveBtn.addEventListener("click", () => {
  const type = typeSelect.value;
  const mod = registry[type];
  const settings = mod.collectSettings(typeFields);
  const name = nameInput.value.trim();

  if(editingId){
    const widget = activePage.widgets.find(w => w.id === editingId);
    widget.settings = settings;
    widget.name = name;
  }else{
    const maxOrderInCol0 = Math.max(-1, ...activePage.widgets.filter(w => w.col === 0).map(w => w.order));
    activePage.widgets.push({ id: uid(), type, name, col: 0, order: maxOrderInCol0 + 1, settings });
  }
  persistAndRender();
  closeWidgetModal();
});

document.getElementById("btn-add-widget").addEventListener("click", () => {
  editingId = null;
  openWidgetModal(null);
});

// ---------------- Settings modal ----------------

const modalSettings = document.getElementById("modal-settings");
const pageNameInput = document.getElementById("setting-page-name");
const bgUrlInput = document.getElementById("setting-bg-url");
const bgFileInput = document.getElementById("setting-bg-file");
const bgClearBtn = document.getElementById("setting-bg-clear");
const tintColorInput = document.getElementById("setting-tint-color");
const tintOpacityInput = document.getElementById("setting-tint-opacity");
const tintOpacityOut = document.getElementById("tint-opacity-out");
const tintBlurInput = document.getElementById("setting-tint-blur");
const tintBlurOut = document.getElementById("tint-blur-out");
const textColorSelect = document.getElementById("setting-text-color");

function rgbToHex(rgbStr){
  const [r, g, b] = rgbStr.split(",").map(n => parseInt(n.trim(), 10));
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}
function hexToRgb(hex){
  const v = hex.replace("#", "");
  const r = parseInt(v.substring(0, 2), 16);
  const g = parseInt(v.substring(2, 4), 16);
  const b = parseInt(v.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

function openSettingsModal(){
  pageNameInput.value = activePage.name || "";
  bgUrlInput.value = activePage.background.value && !activePage.background.value.startsWith("data:") ? activePage.background.value : "";
  tintColorInput.value = rgbToHex(activePage.theme.tintColor);
  tintOpacityInput.value = activePage.theme.tintOpacity;
  tintOpacityOut.textContent = activePage.theme.tintOpacity;
  tintBlurInput.value = activePage.theme.tintBlur;
  tintBlurOut.textContent = activePage.theme.tintBlur;
  textColorSelect.value = activePage.theme.textMode;
  modalSettings.classList.remove("hidden");
}

document.getElementById("btn-settings").addEventListener("click", openSettingsModal);
document.getElementById("settings-modal-close").addEventListener("click", () => modalSettings.classList.add("hidden"));

pageNameInput.addEventListener("change", () => {
  activePage.name = pageNameInput.value.trim();
  saveConfig(config);
  applyTheme();
  renderPageSwitcher();
});

bgUrlInput.addEventListener("change", () => {
  activePage.background.value = bgUrlInput.value.trim();
  applyTheme();
  saveConfig(config);
});

bgFileInput.addEventListener("change", () => {
  const file = bgFileInput.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    activePage.background.value = reader.result;
    applyTheme();
    saveConfig(config);
    showToast("Background updated");
  };
  reader.readAsDataURL(file);
});

bgClearBtn.addEventListener("click", () => {
  activePage.background.value = "";
  bgUrlInput.value = "";
  bgFileInput.value = "";
  applyTheme();
  saveConfig(config);
});

tintColorInput.addEventListener("input", () => {
  activePage.theme.tintColor = hexToRgb(tintColorInput.value);
  applyTheme();
  saveConfig(config);
  renderPageSwitcher();
});
tintOpacityInput.addEventListener("input", () => {
  activePage.theme.tintOpacity = parseFloat(tintOpacityInput.value);
  tintOpacityOut.textContent = activePage.theme.tintOpacity;
  applyTheme();
  saveConfig(config);
});
tintBlurInput.addEventListener("input", () => {
  activePage.theme.tintBlur = parseInt(tintBlurInput.value, 10);
  tintBlurOut.textContent = activePage.theme.tintBlur;
  applyTheme();
  saveConfig(config);
});
textColorSelect.addEventListener("change", () => {
  activePage.theme.textMode = textColorSelect.value;
  applyTheme();
  saveConfig(config);
});

document.getElementById("setting-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "startpage-config.json";
  a.click();
  URL.revokeObjectURL(url);
});

const importFileInput = document.getElementById("import-file-input");
document.getElementById("setting-import").addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", () => {
  const file = importFileInput.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      config = normalizeConfig(parsed);
      activePage = getActivePage(config);
      applyTheme();
      persistAndRender();
      showToast("Config imported");
    }catch(e){
      alert("Invalid config file.");
    }
  };
  reader.readAsText(file);
  importFileInput.value = "";
});

document.getElementById("setting-reset").addEventListener("click", () => {
  if(!confirm("Reset all pages and settings to defaults? This cannot be undone.")) return;
  localStorage.removeItem("startpage.config.v1");
  location.reload();
});

// generic modal close (✕ buttons / overlay click)
document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.close).classList.add("hidden");
  });
});
[modalWidget, modalSettings].forEach(overlay => {
  overlay.addEventListener("click", e => {
    if(e.target === overlay) overlay.classList.add("hidden");
  });
});

function escapeAttr(str){
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------- Init ----------------

applyTheme();
renderAll();

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
