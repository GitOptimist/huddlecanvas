export function installPaletteLayout(rail) {
  const stage = rail.offsetParent || rail.parentElement;
  const tools = document.createElement("div");
  tools.className = "paletteTools";
  tools.append(...rail.children);
  const controls = document.createElement("div");
  controls.className = "paletteControls";
  const grip = document.createElement("button");
  const toggle = document.createElement("button");
  for (const button of [grip, toggle]) {
    button.type = "button";
    controls.append(button);
  }
  grip.textContent = "⠿";
  grip.title = "Move palette · drag or use arrow keys";
  grip.setAttribute("aria-label", grip.title);
  toggle.textContent = "⇄";
  toggle.title = "Horizontal palette";
  toggle.setAttribute("aria-label", toggle.title);
  toggle.setAttribute("aria-pressed", "false");
  rail.setAttribute("aria-orientation", "vertical");
  rail.append(controls, tools);

  function clamp(value, limit) {
    return Math.max(0, Math.min(value, limit));
  }
  function place(x, y) {
    rail.style.left = clamp(x, stage.clientWidth - rail.offsetWidth) + "px";
    rail.style.top = clamp(y, stage.clientHeight - rail.offsetHeight) + "px";
    alignMenus();
  }
  function alignMenus() {
    for (const [menuId, triggerId] of [
      ["shapePopover", "shapesBtn"], ["stickyPopover", "stickyBtn"], ["stampPopover", "stampBtn"],
    ]) {
      const menu = document.getElementById(menuId);
      if (!menu?.offsetWidth) continue;
      const button = document.getElementById(triggerId).getBoundingClientRect();
      const base = stage.getBoundingClientRect();
      const horizontal = rail.classList.contains("horizontalPalette");
      let x = horizontal ? button.left - base.left : rail.offsetLeft + rail.offsetWidth + 6;
      let y = horizontal ? rail.offsetTop + rail.offsetHeight + 6 : button.top - base.top;
      if (!horizontal && x + menu.offsetWidth > stage.clientWidth) x = rail.offsetLeft - menu.offsetWidth - 6;
      if (horizontal && y + menu.offsetHeight > stage.clientHeight) y = rail.offsetTop - menu.offsetHeight - 6;
      menu.style.left = clamp(x, stage.clientWidth - menu.offsetWidth) + "px";
      menu.style.top = clamp(y, stage.clientHeight - menu.offsetHeight) + "px";
    }
  }
  for (const menu of stage.querySelectorAll(".shapePopover,.toolPopover")) {
    new MutationObserver(alignMenus).observe(menu, {attributes:true, attributeFilter:["class"]});
  }
  tools.addEventListener("scroll", alignMenus);
  toggle.onclick = () => {
    const horizontal = rail.classList.toggle("horizontalPalette");
    toggle.setAttribute("aria-pressed", String(horizontal));
    rail.setAttribute("aria-orientation", horizontal ? "horizontal" : "vertical");
    place(rail.offsetLeft, rail.offsetTop);
  };
  let drag;
  grip.onpointerdown = event => {
    if (event.button !== 0 || drag) return;
    drag = {id:event.pointerId, x:event.clientX - rail.offsetLeft, y:event.clientY - rail.offsetTop};
    grip.setPointerCapture(event.pointerId);
  };
  grip.onpointermove = event => {
    if (drag?.id === event.pointerId) place(event.clientX - drag.x, event.clientY - drag.y);
  };
  grip.onlostpointercapture = () => { drag = null; };
  grip.onkeydown = event => {
    const step = event.shiftKey ? 32 : 8;
    const delta = {ArrowLeft:[-step,0], ArrowRight:[step,0], ArrowUp:[0,-step], ArrowDown:[0,step]}[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    place(rail.offsetLeft + delta[0], rail.offsetTop + delta[1]);
  };
  new ResizeObserver(() => {
    if (rail.offsetWidth) place(rail.offsetLeft, rail.offsetTop);
  }).observe(stage);
}
