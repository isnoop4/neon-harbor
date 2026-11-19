// Keyboard and mouse input for Neon Harbor. Held keys give movement and driving;
// one-shot presses (start, pause, steal a car, save) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost or counted
// twice. The mouse aims the pistol; click (or F) fires.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SAVE = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const SAVE = new Set(['KeyQ']);
const MUTE = new Set(['KeyM']);
const FIRE = new Set(['KeyF']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let fired = false;

  function press(code) {
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(code)) actions |= ACTION_ENTER;
    else if (SAVE.has(code)) actions |= ACTION_SAVE;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
    else if (FIRE.has(code)) fired = true;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code) || PAUSE.has(event.code) || ENTER.has(event.code) || SAVE.has(event.code) || MUTE.has(event.code) || FIRE.has(event.code)) {
      if (!event.repeat) press(event.code);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    if (event.button === 0) fired = true;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  const has = (set) => {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  };

  return {
    moveX() { return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0); },
    moveY() { return (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0); },
    get up() { return has(UP); },
    get down() { return has(DOWN); },
    get steer() { return (has(LEFT) ? 1 : 0) - (has(RIGHT) ? 1 : 0); },
    get run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    get mouseDown() { return mouseDown; },
    get mouse() { return { x: mouseX, y: mouseY }; },
    /** True once per click / F press. */
    takeFire() {
      const f = fired;
      fired = false;
      return f;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
