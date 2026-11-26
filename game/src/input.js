// input.js — keyboard and mouse, kept as one small state object the flight model
// reads every step. Edge actions (start, pause, restart, mute) are consumed once.

export function createInput(canvas) {
  const keys = new Set();
  const actions = new Set();

  function code(event) {
    return event.code;
  }

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions.add('start');
    if (event.code === 'KeyP' || event.code === 'Escape') actions.add('pause');
    if (event.code === 'KeyR') actions.add('restart');
    if (event.code === 'KeyM') actions.add('mute');
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseDown() {
    actions.add('start');
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);

  function held(...codes) {
    return codes.some((c) => keys.has(c));
  }

  return {
    /** Continuous flight controls, -1..1 each, read every simulation step. */
    read() {
      return {
        pitch: held('ArrowUp', 'KeyW') ? 1 : held('ArrowDown', 'KeyS') ? -1 : 0,
        roll: held('ArrowLeft', 'KeyA') ? 1 : held('ArrowRight', 'KeyD') ? -1 : 0,
        throttleUp: held('ShiftLeft', 'ShiftRight', 'Equal', 'NumpadAdd'),
        throttleDown: held('ControlLeft', 'ControlRight', 'Minus', 'NumpadSubtract'),
      };
    },
    /** Take a one-shot action if it was pressed since the last call. */
    consume(name) {
      if (actions.has(name)) {
        actions.delete(name);
        return true;
      }
      return false;
    },
  };
}
