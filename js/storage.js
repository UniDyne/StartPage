const STORAGE_KEY = "startpage.config.v1";
const IMAGE_KEY_PREFIX = "startpage.image.";
const LOCAL_IMAGE_PREFIX = "localimage:";

export function uid(){
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Background images are stored under their own localStorage keys instead of
// inline in the config blob — a full-resolution photo as a data: URI can be
// several MB, and having it embedded in `config` meant every save (including
// ones triggered by dragging a widget) re-serialized and rewrote all of it.
// page.background.value holds a small "localimage:<id>" reference instead.
export function isLocalImageRef(value){
  return typeof value === "string" && value.startsWith(LOCAL_IMAGE_PREFIX);
}
export function localImageRef(id){
  return LOCAL_IMAGE_PREFIX + id;
}
export function localImageId(ref){
  return isLocalImageRef(ref) ? ref.slice(LOCAL_IMAGE_PREFIX.length) : null;
}

export function saveImage(dataUrl){
  const id = uid();
  localStorage.setItem(IMAGE_KEY_PREFIX + id, dataUrl);
  return id;
}
export function setImage(id, dataUrl){
  localStorage.setItem(IMAGE_KEY_PREFIX + id, dataUrl);
}
export function getImage(id){
  return localStorage.getItem(IMAGE_KEY_PREFIX + id);
}
export function deleteImage(id){
  localStorage.removeItem(IMAGE_KEY_PREFIX + id);
}
export function clearAllImages(){
  const keys = [];
  for(let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if(k && k.startsWith(IMAGE_KEY_PREFIX)) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
}

// Resolves a background.value (URL, local image reference, or empty) to what
// should actually be used as the CSS background-image source.
export function resolveBackgroundValue(value){
  if(!value) return "";
  if(isLocalImageRef(value)) return getImage(localImageId(value)) || "";
  return value;
}

export function setPageBackgroundImage(page, dataUrl){
  clearPageBackgroundImage(page);
  page.background.value = localImageRef(saveImage(dataUrl));
}

export function clearPageBackgroundImage(page){
  const value = page.background && page.background.value;
  if(isLocalImageRef(value)) deleteImage(localImageId(value));
}

// Restores an exported page's "images" collection into local image storage
// under freshly generated ids (avoids colliding with any existing images)
// and rewrites each page's background.value to point at the new id.
function importImages(pages, images){
  if(!images) return;
  const idMap = {};
  Object.keys(images).forEach(oldId => {
    const newId = uid();
    idMap[oldId] = newId;
    setImage(newId, images[oldId]);
  });
  pages.forEach(page => {
    const value = page.background && page.background.value;
    if(isLocalImageRef(value)){
      const newId = idMap[localImageId(value)];
      if(newId) page.background.value = localImageRef(newId);
    }
  });
}

// Configs/pages saved before local-image storage existed have the raw
// data: URI inline in background.value — move it into its own key so it
// doesn't keep getting re-serialized on every save.
function migrateInlineBackgroundImages(pages){
  pages.forEach(page => {
    const value = page.background && page.background.value;
    if(typeof value === "string" && value.startsWith("data:")){
      page.background.value = localImageRef(saveImage(value));
    }
  });
}

function defaultTheme(){
  return {
    tintColor: "16,16,16",
    tintOpacity: 0.35,
    tintBlur: 14,
    textMode: "light"
  };
}

export function defaultSearchBar(){
  return {
    enabled: false,
    provider: "duckduckgo",
    customTemplate: "",
    openInNewTab: false
  };
}

function firstPageWidgets(){
  return [
    { id: uid(), type: "datetime", name: "Clock", col: 0, order: 0, settings: { layout: "large", hour12: true, showSeconds: true, showDate: true } },
    { id: uid(), type: "ipinfo", name: "Network", col: 1, order: 0, settings: {} },
    { id: uid(), type: "links", name: "Links", col: 2, order: 0, settings: { title: "Links", layout: "grid", links: [
      { label: "GitHub", url: "https://github.com" },
      { label: "Gmail", url: "https://mail.google.com" }
    ] } },
    { id: uid(), type: "markdown", name: "Notes", col: 3, order: 0, settings: { title: "Notes", body: "# Welcome\n\nEdit this widget to write **markdown** notes." } }
  ];
}

export function createPage({ name, widgets, background, theme, hidden, search } = {}){
  return {
    id: uid(),
    name: name || "Page",
    background: background || { value: "" },
    theme: theme || defaultTheme(),
    widgets: widgets || [],
    hidden: hidden || false,
    search: { ...defaultSearchBar(), ...(search || {}) }
  };
}

export function defaultConfig(){
  const page = createPage({ name: "Page 1", widgets: firstPageWidgets() });
  return { pages: [page], activePageId: page.id };
}

function isValidPagesConfig(parsed){
  return !!parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0 && typeof parsed.activePageId === "string";
}

// Accepts either the current { pages, activePageId } shape or the legacy
// single-page { background, theme, widgets } shape and normalizes to the former.
export function normalizeConfig(parsed){
  if(isValidPagesConfig(parsed)){
    parsed.pages.forEach(p => { p.search = { ...defaultSearchBar(), ...(p.search || {}) }; });
    importImages(parsed.pages, parsed.images);
    delete parsed.images;
    migrateInlineBackgroundImages(parsed.pages);
    if(!parsed.pages.some(p => p.id === parsed.activePageId)){
      parsed.activePageId = parsed.pages[0].id;
    }
    return parsed;
  }
  if(parsed && Array.isArray(parsed.widgets)){
    const page = createPage({
      name: "Page 1",
      widgets: parsed.widgets,
      background: parsed.background,
      theme: parsed.theme
    });
    migrateInlineBackgroundImages([page]);
    return { pages: [page], activePageId: page.id };
  }
  return defaultConfig();
}

export function loadConfig(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultConfig();
    const normalized = normalizeConfig(JSON.parse(raw));
    saveConfig(normalized);
    return normalized;
  }catch(e){
    console.warn("Failed to load config, using defaults", e);
    return defaultConfig();
  }
}

export function saveConfig(config){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getActivePage(config){
  return config.pages.find(p => p.id === config.activePageId) || config.pages[0];
}

// Collects the local images referenced by a set of pages into a plain
// { id: dataUrl } map, keyed by the same ids the pages' background.value
// references already use.
function collectImages(pages){
  const images = {};
  pages.forEach(page => {
    const value = page.background && page.background.value;
    if(isLocalImageRef(value)){
      const id = localImageId(value);
      const data = getImage(id);
      if(data) images[id] = data;
    }
  });
  return images;
}

// The "images" key is deliberately placed last in the returned object so it
// serializes at the end of the exported JSON, after the small page/widget data.
export function preparePageForExport(page){
  return {
    format: "startpage-page",
    version: 1,
    page: {
      name: page.name,
      background: page.background,
      theme: page.theme,
      widgets: page.widgets,
      search: page.search
    },
    images: collectImages([page])
  };
}

export function prepareConfigForExport(config){
  return {
    pages: config.pages,
    activePageId: config.activePageId,
    images: collectImages(config.pages)
  };
}

// Accepts either the wrapped { format: "startpage-page", page } shape or a
// bare page-like object, and returns a fresh page with regenerated ids.
export function pageFromImport(parsed){
  const src = parsed && parsed.format === "startpage-page" && parsed.page ? parsed.page
    : (parsed && Array.isArray(parsed.widgets) ? parsed : null);
  if(!src) return null;
  const widgets = Array.isArray(src.widgets) ? src.widgets.map(w => ({ ...w, id: uid() })) : [];
  const page = createPage({
    name: src.name,
    widgets,
    background: src.background,
    theme: src.theme,
    search: src.search
  });
  importImages([page], parsed && parsed.images);
  migrateInlineBackgroundImages([page]);
  return page;
}
