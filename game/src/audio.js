// Sound for Neon Harbor, synthesized with WebAudio — no audio files, no network.
// Everything is a short oscillator or noise burst, started only after the player
// first interacts (browsers block audio before that).
export function createAudio() {
  let ctx = null;
  let muted = false;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
    return ctx;
  }

  function tone(freq, dur, type, gain, slideTo) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    try {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
      g.gain.setValueAtTime(gain || 0.06, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.connect(g).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur);
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  }

  function noise(dur, gain) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    try {
      const len = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      const g = ac.createGain();
      src.buffer = buf;
      g.gain.setValueAtTime(gain || 0.12, ac.currentTime);
      src.connect(g).connect(ac.destination);
      src.start();
    } catch {
      // Ignore audio failures.
    }
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() { muted = !muted; return muted; },
    shoot() { noise(0.12, 0.14); tone(180, 0.1, 'sawtooth', 0.05, 60); },
    pickup() { tone(660, 0.09, 'sine', 0.07); tone(990, 0.12, 'sine', 0.06); },
    hit() { tone(120, 0.15, 'sawtooth', 0.08, 70); },
    crash() { noise(0.2, 0.16); },
    mission() { tone(523, 0.12, 'sine', 0.07); tone(659, 0.12, 'sine', 0.07); tone(784, 0.2, 'sine', 0.08); },
    siren(dt, wanted) {
      if (wanted <= 0 || muted) return;
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.9;
        tone(700, 0.4, 'sine', 0.025, 950);
        tone(950, 0.4, 'sine', 0.02, 700);
      }
    },
  };
}
