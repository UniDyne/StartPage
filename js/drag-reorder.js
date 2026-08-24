// Generic cross-widget drag-and-drop reordering for a list of item nodes
// (each with a stable `id`) rendered inside a container element. Used by any
// widget type whose items should be draggable within themselves and into
// other instances of the same widget type (links, to-do items, markdown
// articles). Each widget module calls createDragCoordinator() to get its own
// independent state — an item from one widget type is never a valid drop for
// another's, so state is not shared globally, only across instances of the
// same coordinator (i.e. same widget type).
export function createDragCoordinator(itemClass){
  let dragState = null; // { widgetId, id }
  const instances = new Map(); // widgetId -> { getItem, removeItem, reconcileOrder }

  function clearDragOverStyling(containerSelector){
    document.querySelectorAll(`${containerSelector}.drag-over`).forEach(el => el.classList.remove("drag-over"));
  }

  // Picks the element the dragged item should be inserted before, using both
  // axes so it behaves for a wrapping grid as well as a single-column list.
  function getDragAfterElement(container, x, y){
    const els = [...container.querySelectorAll(`.${itemClass}:not(.dragging)`)];
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

  function finalizeDrag(dragEl, containerSelector){
    if(!dragState) return;
    const targetContainer = dragEl.closest(containerSelector);
    if(!targetContainer) return;
    const targetWidgetId = targetContainer.dataset.widgetId;
    const targetApi = instances.get(targetWidgetId);
    if(!targetApi) return;
    const ids = [...targetContainer.querySelectorAll(`.${itemClass}`)].map(n => n.dataset.id);

    if(dragState.widgetId === targetWidgetId){
      targetApi.reconcileOrder(ids);
    }else{
      const sourceApi = instances.get(dragState.widgetId);
      const movedItem = sourceApi ? sourceApi.getItem(dragState.id) : null;
      if(sourceApi) sourceApi.removeItem(dragState.id);
      targetApi.reconcileOrder(ids, movedItem);
    }
  }

  return {
    register(widgetId, api){ instances.set(widgetId, api); },
    unregister(widgetId){ instances.delete(widgetId); },

    // Marks a rendered item node as draggable and wires its drag lifecycle.
    // `containerSelector` identifies valid drop-target containers (e.g. ".todo-list").
    makeItemDraggable(node, widgetId, itemId, containerSelector){
      node.draggable = true;
      node.dataset.id = itemId;
      node.addEventListener("dragstart", e => {
        dragState = { widgetId, id: itemId };
        node.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", itemId);
      });
      node.addEventListener("dragend", () => {
        node.classList.remove("dragging");
        clearDragOverStyling(containerSelector);
        finalizeDrag(node, containerSelector);
        dragState = null;
      });
    },

    // Wires a container element (kept alive across re-renders) to accept drops.
    // `emptyClass`, if given, identifies an empty-state placeholder node to
    // remove the moment an item is dragged over an empty container.
    wireContainer(containerEl, containerSelector, emptyClass){
      containerEl.addEventListener("dragover", e => {
        if(!dragState) return;
        e.preventDefault();
        const dragEl = document.querySelector(`.${itemClass}.dragging`);
        if(!dragEl) return;
        if(emptyClass){
          const empty = containerEl.querySelector(`.${emptyClass}`);
          if(empty) empty.remove();
        }
        clearDragOverStyling(containerSelector);
        containerEl.classList.add("drag-over");
        const afterEl = getDragAfterElement(containerEl, e.clientX, e.clientY);
        if(afterEl == null) containerEl.appendChild(dragEl);
        else containerEl.insertBefore(dragEl, afterEl);
      });
      containerEl.addEventListener("drop", e => { e.preventDefault(); });
    }
  };
}
