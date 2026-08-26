export const meta = { type: "ipinfo", label: "IP & User Agent" };

const IPV4_URL = "https://api.ipify.org?format=json";
const IPV6_URL = "https://api64.ipify.org?format=json";
const WHOIS_URL = "https://ipwho.is/";

// ipify (and ipwho.is) start returning 429s if queried too often — only
// refetch if the cached result is older than this, regardless of how often
// the widget remounts.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function defaultSettings(){
  return { ipv4: null, ipv6: null, location: null, isp: null, fetchedAt: 0 };
}

export function renderSettingsForm(container, settings){
  const s = { ...defaultSettings(), ...settings };
  container.innerHTML = `
    <input type="hidden" data-field="cache" value='${escapeAttr(JSON.stringify({ ipv4: s.ipv4, ipv6: s.ipv6, location: s.location, isp: s.isp, fetchedAt: s.fetchedAt }))}'>
    <p style="font-size:12px; color:rgba(255,255,255,0.6);">No configurable options for this widget.</p>
  `;
}

export function collectSettings(container){
  try{
    return JSON.parse(container.querySelector('[data-field="cache"]').value || "{}");
  }catch(e){
    return defaultSettings();
  }
}

async function fetchIp(url){
  try{
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error("bad response");
    const data = await res.json();
    return data.ip || null;
  }catch(e){
    return null;
  }
}

// Location/ISP metadata from ipwho.is. ipify remains the source for the
// IPv4/IPv6 address rows themselves (it's the one that reliably supports both).
async function fetchWhois(){
  try{
    const res = await fetch(WHOIS_URL, { cache: "no-store" });
    if(!res.ok) throw new Error("bad response");
    const data = await res.json();
    if(!data || data.success === false) return null;

    const location = [data.city, data.region, data.country].filter(Boolean).join(", ") || null;

    const connection = data.connection || {};
    const ispParts = [];
    if(connection.isp) ispParts.push(connection.isp);
    if(connection.asn) ispParts.push(`AS${connection.asn}`);
    const isp = ispParts.join(" · ") || null;

    return { location, isp };
  }catch(e){
    return null;
  }
}

const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

function copyBtnHtml(){
  return `<button class="copy-btn" data-copy title="Copy" aria-label="Copy">${COPY_ICON}</button>`;
}

export function mount(el, widget, ctx){
  const s = { ...defaultSettings(), ...widget.settings };
  el.classList.add("w-ipinfo");

  const isStale = !s.fetchedAt || (Date.now() - s.fetchedAt) > REFRESH_INTERVAL_MS;
  const initialIpv4 = s.ipv4 || (isStale ? "loading…" : "unavailable");
  const initialIpv6 = s.ipv6 || (isStale ? "loading…" : "unavailable");
  const initialLocation = s.location || (isStale ? "loading…" : "unavailable");
  const initialIsp = s.isp || (isStale ? "loading…" : "unavailable");

  el.innerHTML = `
    <div class="row" data-row="ipv4">
      <span class="label">IPv4</span>
      <span class="value">${escapeHtml(initialIpv4)}</span>
      ${copyBtnHtml()}
    </div>
    <div class="row" data-row="ipv6">
      <span class="label">IPv6</span>
      <span class="value">${escapeHtml(initialIpv6)}</span>
      ${copyBtnHtml()}
    </div>
    <div class="row" data-row="location">
      <span class="label">Location</span>
      <span class="value">${escapeHtml(initialLocation)}</span>
      ${copyBtnHtml()}
    </div>
    <div class="row" data-row="isp">
      <span class="label">ISP</span>
      <span class="value">${escapeHtml(initialIsp)}</span>
      ${copyBtnHtml()}
    </div>
    <div class="row" data-row="ua">
      <span class="label">Agent</span>
      <span class="value">${escapeHtml(navigator.userAgent)}</span>
      ${copyBtnHtml()}
    </div>
  `;

  function wireCopy(row, getValue){
    const btn = row.querySelector("[data-copy]");
    btn.addEventListener("click", async () => {
      const value = getValue();
      if(!value) return;
      try{
        await navigator.clipboard.writeText(value);
        btn.innerHTML = CHECK_ICON;
        btn.classList.add("copied");
        setTimeout(() => {
          btn.innerHTML = COPY_ICON;
          btn.classList.remove("copied");
        }, 1200);
      }catch(e){
        console.warn("Copy failed", e);
      }
    });
  }

  const ipv4Row = el.querySelector('[data-row="ipv4"]');
  const ipv6Row = el.querySelector('[data-row="ipv6"]');
  const locationRow = el.querySelector('[data-row="location"]');
  const ispRow = el.querySelector('[data-row="isp"]');
  const uaRow = el.querySelector('[data-row="ua"]');

  wireCopy(ipv4Row, () => ipv4Row.querySelector(".value").textContent);
  wireCopy(ipv6Row, () => ipv6Row.querySelector(".value").textContent);
  wireCopy(locationRow, () => locationRow.querySelector(".value").textContent);
  wireCopy(ispRow, () => ispRow.querySelector(".value").textContent);
  wireCopy(uaRow, () => navigator.userAgent);

  let cancelled = false;

  if(isStale){
    (async () => {
      const [v4, v6, whois] = await Promise.all([fetchIp(IPV4_URL), fetchIp(IPV6_URL), fetchWhois()]);
      if(cancelled) return;
      // Keep the last known-good value if this attempt failed (e.g. rate limited),
      // but always stamp fetchedAt so we don't immediately retry.
      const next = {
        ipv4: v4 || s.ipv4 || null,
        ipv6: v6 || s.ipv6 || null,
        location: (whois && whois.location) || s.location || null,
        isp: (whois && whois.isp) || s.isp || null,
        fetchedAt: Date.now()
      };
      ipv4Row.querySelector(".value").textContent = next.ipv4 || "unavailable";
      ipv6Row.querySelector(".value").textContent = next.ipv6 || "unavailable";
      locationRow.querySelector(".value").textContent = next.location || "unavailable";
      ispRow.querySelector(".value").textContent = next.isp || "unavailable";
      if(ctx && ctx.onSettingsChange) ctx.onSettingsChange(next);
    })();
  }

  return {
    destroy(){ cancelled = true; }
  };
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
