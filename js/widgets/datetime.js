export const meta = { type: "datetime", label: "Date & Time" };

export function defaultSettings(){
  return { layout: "large", hour12: true, showSeconds: true, showDate: true };
}

export function renderSettingsForm(container, settings){
  const s = { ...defaultSettings(), ...settings };
  container.innerHTML = `
    <label class="field">
      <span>Layout</span>
      <select data-field="layout">
        <option value="large" ${s.layout==="large"?"selected":""}>Large stacked</option>
        <option value="stacked-center" ${s.layout==="stacked-center"?"selected":""}>Centered stacked</option>
        <option value="compact" ${s.layout==="compact"?"selected":""}>Compact inline</option>
        <option value="minimal" ${s.layout==="minimal"?"selected":""}>Minimal</option>
      </select>
    </label>
    <label class="field">
      <span>Time format</span>
      <select data-field="hour12">
        <option value="true" ${s.hour12?"selected":""}>12-hour</option>
        <option value="false" ${!s.hour12?"selected":""}>24-hour</option>
      </select>
    </label>
    <label class="field" style="flex-direction:row; align-items:center; gap:8px;">
      <input type="checkbox" data-field="showSeconds" ${s.showSeconds?"checked":""} style="width:auto;">
      <span>Show seconds</span>
    </label>
    <label class="field" style="flex-direction:row; align-items:center; gap:8px;">
      <input type="checkbox" data-field="showDate" ${s.showDate?"checked":""} style="width:auto;">
      <span>Show date</span>
    </label>
  `;
}

export function collectSettings(container){
  const layout = container.querySelector('[data-field="layout"]').value;
  const hour12 = container.querySelector('[data-field="hour12"]').value === "true";
  const showSeconds = container.querySelector('[data-field="showSeconds"]').checked;
  const showDate = container.querySelector('[data-field="showDate"]').checked;
  return { layout, hour12, showSeconds, showDate };
}

export function mount(el, widget){
  const s = { ...defaultSettings(), ...widget.settings };
  el.classList.add("w-datetime", `layout-${s.layout}`);
  el.innerHTML = `<div class="time"></div><div class="date"></div>`;
  const timeEl = el.querySelector(".time");
  const dateEl = el.querySelector(".date");
  dateEl.style.display = s.showDate ? "" : "none";

  function tick(){
    const now = new Date();
    const timeOpts = { hour: "2-digit", minute: "2-digit", hour12: s.hour12 };
    if(s.showSeconds) timeOpts.second = "2-digit";
    timeEl.textContent = new Intl.DateTimeFormat(undefined, timeOpts).format(now);
    if(s.showDate){
      dateEl.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(now);
    }
  }
  tick();
  const interval = setInterval(tick, 1000);

  return {
    destroy(){ clearInterval(interval); }
  };
}
