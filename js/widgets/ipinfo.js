export const meta = { type: "ipinfo", label: "IP & User Agent" };

const IPV4_URL = "https://api.ipify.org?format=json";
const IPV6_URL = "https://api64.ipify.org?format=json";

export function defaultSettings(){
  return {};
}

export function renderSettingsForm(container){
  container.innerHTML = `<p style="font-size:12px; color:rgba(255,255,255,0.6);">No configurable options for this widget.</p>`;
}

export function collectSettings(){
  return {};
}

async function fetchIp(url){
  try{
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error("bad response");
    const data = await res.json();
    return data.ip || "—";
  }catch(e){
    return null;
  }
}

const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

function copyBtnHtml(){
  return `<button class="copy-btn" data-copy title="Copy" aria-label="Copy">${COPY_ICON}</button>`;
}

export function mount(el){
  el.classList.add("w-ipinfo");
  el.innerHTML = `
    <div class="row" data-row="ipv4">
      <span class="label">IPv4</span>
      <span class="value">loading…</span>
      ${copyBtnHtml()}
    </div>
    <div class="row" data-row="ipv6">
      <span class="label">IPv6</span>
      <span class="value">loading…</span>
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
  const uaRow = el.querySelector('[data-row="ua"]');

  wireCopy(ipv4Row, () => ipv4Row.querySelector(".value").textContent);
  wireCopy(ipv6Row, () => ipv6Row.querySelector(".value").textContent);
  wireCopy(uaRow, () => navigator.userAgent);

  let cancelled = false;

  (async () => {
    const [v4, v6] = await Promise.all([fetchIp(IPV4_URL), fetchIp(IPV6_URL)]);
    if(cancelled) return;
    ipv4Row.querySelector(".value").textContent = v4 || "unavailable";
    ipv6Row.querySelector(".value").textContent = v6 || "unavailable";
  })();

  return {
    destroy(){ cancelled = true; }
  };
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
