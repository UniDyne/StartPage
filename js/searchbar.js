export const PROVIDERS = [
  { id: "duckduckgo", label: "DuckDuckGo", template: "https://duckduckgo.com/?q={q}", domain: "duckduckgo.com" },
  { id: "google", label: "Google", template: "https://www.google.com/search?q={q}", domain: "google.com" },
  { id: "bing", label: "Bing", template: "https://www.bing.com/search?q={q}", domain: "bing.com" },
  { id: "custom", label: "Custom…", template: "", domain: "" }
];

export function getProvider(id){
  return PROVIDERS.find(p => p.id === id) || PROVIDERS[0];
}

// Returns the URL template ({q} placeholder) to use for a given search config.
export function templateFor(search){
  if(search.provider === "custom") return search.customTemplate || "";
  return getProvider(search.provider).template;
}

export function buildSearchUrl(search, query){
  const template = templateFor(search);
  if(!template) return "";
  return template.replace("{q}", encodeURIComponent(query));
}

// Best-effort favicon lookup for the active provider/template via a favicon service.
export function faviconUrlFor(search){
  const domain = domainFor(search);
  if(!domain) return "";
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
}

function domainFor(search){
  if(search.provider !== "custom") return getProvider(search.provider).domain;
  const template = search.customTemplate || "";
  if(!template) return "";
  try{
    return new URL(template.replace("{q}", "test")).hostname;
  }catch(e){
    return "";
  }
}
