import { registry } from "./registry.js";

let mounted = []; // { id, instance }
let dragState = null;

export function renderBoard(config, board, handlers){
  // tear down previous live widgets (clears intervals etc.)
  mounted.forEach(m => { try{ m.instance && m.instance.destroy && m.instance.destroy(); }catch(e){} });
  mounted = [];

  const columns = [...board.querySelectorAll(".column")];
  columns.forEach(col => { col.innerHTML = ""; });

  const byColumn = {};
  config.widgets.forEach(w => {
    (byColumn[w.col] ||= []).push(w);
  });
  Object.values(byColumn).forEach(list => list.sort((a, b) => a.order - b.order));

  columns.forEach((colEl, colIndex) => {
    const widgets = byColumn[colIndex] || [];
    widgets.forEach(widget => {
      const node = buildWidgetNode(widget, handlers);
      colEl.appendChild(node);
    });
    wireColumnDnD(colEl, handlers);
  });
}

function buildWidgetNode(widget, handlers){
  const mod = registry[widget.type];
  const wrapper = document.createElement("div");
  wrapper.className = "widget";
  wrapper.dataset.id = widget.id;
  wrapper.draggable = false;

  const head = document.createElement("div");
  head.className = "widget-head";
  head.draggable = true;
  const displayName = (widget.name && widget.name.trim()) || (mod ? mod.meta.label : widget.type);
  head.innerHTML = `
    <span>${escapeHtml(displayName)}</span>
    <span class="spacer"></span>
    <span class="widget-head-actions">
      <button class="icon-btn" data-action="edit" title="Edit">✎</button>
      <button class="icon-btn" data-action="delete" title="Remove">✕</button>
    </span>
  `;

  head.addEventListener("dragstart", e => {
    dragState = { id: widget.id };
    wrapper.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", widget.id);
  });
  head.addEventListener("dragend", () => {
    wrapper.classList.remove("dragging");
    dragState = null;
    clearDragOverStyling();
  });

  head.querySelector('[data-action="edit"]').addEventListener("click", () => handlers.onEdit(widget.id));
  head.querySelector('[data-action="delete"]').addEventListener("click", () => handlers.onDelete(widget.id));

  const body = document.createElement("div");
  body.className = "widget-body";

  wrapper.appendChild(head);
  wrapper.appendChild(body);

  if(mod){
    const instance = mod.mount(body, widget, {
      onSettingsChange: newSettings => handlers.onSettingsChange(widget.id, newSettings),
      headActions: head.querySelector(".widget-head-actions")
    });
    mounted.push({ id: widget.id, instance });
  }else{
    body.innerHTML = `<p style="font-size:12px;color:#f99;">Unknown widget type: ${widget.type}</p>`;
  }

  return wrapper;
}

function wireColumnDnD(colEl, handlers){
  colEl.addEventListener("dragover", e => {
    if(!dragState) return;
    e.preventDefault();
    clearDragOverStyling();
    colEl.classList.add("drag-over");
    const afterEl = getDragAfterElement(colEl, e.clientY);
    const dragEl = document.querySelector(`.widget[data-id="${dragState.id}"]`);
    if(!dragEl) return;
    if(afterEl == null){
      colEl.appendChild(dragEl);
    }else{
      colEl.insertBefore(dragEl, afterEl);
    }
  });

  colEl.addEventListener("drop", e => {
    e.preventDefault();
    clearDragOverStyling();
    commitOrder(colEl.closest(".board"), handlers);
  });
}

function clearDragOverStyling(){
  document.querySelectorAll(".column.drag-over").forEach(col => col.classList.remove("drag-over"));
}

function getDragAfterElement(colEl, y){
  const els = [...colEl.querySelectorAll(".widget:not(.dragging)")];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if(offset < 0 && offset > closest.offset){
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function commitOrder(board, handlers){
  const columns = [...board.querySelectorAll(".column")];
  const updates = [];
  columns.forEach((colEl, colIndex) => {
    [...colEl.querySelectorAll(".widget")].forEach((node, order) => {
      updates.push({ id: node.dataset.id, col: colIndex, order });
    });
  });
  handlers.onReorder(updates);
}
