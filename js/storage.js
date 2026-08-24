const STORAGE_KEY = "startpage.config.v1";

export function uid(){
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
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
    }
  };
}

// Accepts either the wrapped { format: "startpage-page", page } shape or a
// bare page-like object, and returns a fresh page with regenerated ids.
export function pageFromImport(parsed){
  const src = parsed && parsed.format === "startpage-page" && parsed.page ? parsed.page
    : (parsed && Array.isArray(parsed.widgets) ? parsed : null);
  if(!src) return null;
  const widgets = Array.isArray(src.widgets) ? src.widgets.map(w => ({ ...w, id: uid() })) : [];
  return createPage({
    name: src.name,
    widgets,
    background: src.background,
    theme: src.theme,
    search: src.search
  });
}
