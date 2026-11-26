// audio.js — synthesized sound only: an engine drone that follows the throttle,
// wind that follows speed, a chime for a ring and a thud for a crash. No files,
// no network, and nothing starts until the player first presses a key or clicks.

export function createAudio() {
  let context = null;
  let engine = null;
  let engineGain = null;
  let wind = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
    engine = context.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 70;
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engine.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(context.destination);
    engine.start();

    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    wind = context.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windGain = context.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(context.destination);
    wind.start();
  }

  function blip(frequency, seconds, type, volume) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume || 0.16, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + seconds);
  }

  return {
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume();
    },
    /** Called every frame with the plane's throttle (0..1) and speed. */
    update(throttle, speed) {
      if (!context || muted) return;
      const t = context.currentTime;
      engine.frequency.setTargetAtTime(58 + throttle * 66 + speed * 0.35, t, 0.08);
      engineGain.gain.setTargetAtTime(0.028 + throttle * 0.05, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.09, speed * 0.0011), t, 0.15);
    },
    ring() {
      blip(880, 0.16, 'sine', 0.18);
      setTimeout(() => blip(1318, 0.24, 'sine', 0.14), 90);
    },
    land() {
      blip(523, 0.2, 'sine', 0.16);
      setTimeout(() => blip(784, 0.3, 'sine', 0.14), 120);
    },
    crash() {
      if (!context || muted) return;
      const buffer = context.createBuffer(1, context.sampleRate * 0.4, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = 0.3;
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
    },
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
    },
    get muted() {
      return muted;
    },
  };
}
