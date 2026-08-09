export const meta = { type: "todo", label: "To-do List" };

export function defaultSettings(){
  return { title: "", items: [] };
}

export function renderSettingsForm(container, settings){
  const s = { ...defaultSettings(), ...settings };
  container.innerHTML = `
    <label class="field">
      <span>Title (optional)</span>
      <input type="text" data-field="title" value="${escapeAttr(s.title)}" placeholder="To-do">
    </label>
    <input type="hidden" data-field="items" value='${escapeAttr(JSON.stringify(s.items))}'>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);">Add, check off, and remove items directly on the widget itself.</p>
  `;
}

export function collectSettings(container){
  const title = container.querySelector('[data-field="title"]').value.trim();
  const items = JSON.parse(container.querySelector('[data-field="items"]').value || "[]");
  return { title, items };
}

export function mount(el, widget, ctx){
  const s = { ...defaultSettings(), ...widget.settings, items: (widget.settings.items || []).map(i => ({ ...i })) };
  el.classList.add("w-todo");

  const titleHtml = s.title ? `<div class="todo-title">${escapeHtml(s.title)}</div>` : "";
  el.innerHTML = `
    ${titleHtml}
    <form class="todo-add-row">
      <input type="text" class="todo-add-input" placeholder="Add an item…" autocomplete="off">
      <button type="submit" class="todo-add-btn" title="Add item" aria-label="Add item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </form>
    <ul class="todo-list"></ul>
  `;

  const listEl = el.querySelector(".todo-list");
  const form = el.querySelector(".todo-add-row");
  const input = el.querySelector(".todo-add-input");

  function persist(){
    ctx.onSettingsChange({ title: s.title, items: s.items });
  }

  function renderItems(){
    if(!s.items.length){
      listEl.innerHTML = `<li class="todo-empty">No items yet.</li>`;
      return;
    }
    listEl.innerHTML = s.items.map(item => `
      <li class="todo-item ${item.done ? "done" : ""}" data-id="${item.id}">
        <input type="checkbox" ${item.done ? "checked" : ""}>
        <span class="todo-text">${escapeHtml(item.text)}</span>
        <button type="button" class="icon-btn todo-remove" title="Remove">✕</button>
      </li>
    `).join("");

    listEl.querySelectorAll(".todo-item").forEach(row => {
      const id = row.dataset.id;
      row.querySelector('input[type="checkbox"]').addEventListener("change", e => {
        const item = s.items.find(i => i.id === id);
        if(item){ item.done = e.target.checked; row.classList.toggle("done", item.done); persist(); }
      });
      row.querySelector(".todo-remove").addEventListener("click", () => {
        s.items = s.items.filter(i => i.id !== id);
        renderItems();
        persist();
      });
    });
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const text = input.value.trim();
    if(!text) return;
    s.items.push({ id: uid(), text, done: false });
    input.value = "";
    renderItems();
    persist();
  });

  renderItems();

  return { destroy(){} };
}

function uid(){
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
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
