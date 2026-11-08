/** Efectos de sonido sintetizados con Web Audio: no hace falta descargar archivos. */
export class Sound {
  private ctx?: AudioContext;
  muted: boolean;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  get context() {
    return this.ctx;
  }

  /** El navegador solo permite sonido después de una interacción del usuario. */
  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(freq: number, duration: number, { type = "square" as OscillatorType, volume = 0.08, delay = 0, slideTo = 0 } = {}) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noise(duration: number, volume = 0.25, cutoff = 1200) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + duration);
    gain.gain.setValueAtTime(volume, t);
    source.connect(filter).connect(gain).connect(this.ctx.destination);
    source.start(t);
  }

  coin() {
    this.tone(988, 0.07);
    this.tone(1319, 0.12, { delay: 0.06 });
  }

  /** Fanfarria rápida y brillante al agarrar la estrella. */
  star() {
    [523, 784, 659, 988, 784, 1175, 1047, 1568].forEach((f, i) =>
      this.tone(f, 0.09, { delay: i * 0.055, type: i % 2 ? "square" : "triangle", volume: 0.09 }),
    );
  }

  /** Caja registradora con campanita: subió el multiplicador. */
  station(multiplier: number) {
    const base = 660 + multiplier * 60;
    this.tone(base, 0.06, { type: "square", volume: 0.07 });
    this.tone(base * 1.5, 0.08, { type: "square", volume: 0.07, delay: 0.06 });
    this.tone(base * 2, 0.25, { type: "triangle", volume: 0.1, delay: 0.13 });
  }

  /** Zumbido de aire al pasar rozando; más agudo con cada combo. */
  nearMiss(combo: number) {
    this.noise(0.14, 0.12, 3000 + combo * 600);
    this.tone(520 + combo * 90, 0.12, { type: "triangle", volume: 0.06, slideTo: 900 + combo * 120 });
  }

  milestone() {
    [659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.12, { delay: i * 0.08, type: "square", volume: 0.06 }));
  }

  smash() {
    this.noise(0.18, 0.18, 2400);
    this.tone(220, 0.15, { type: "sawtooth", volume: 0.06, slideTo: 90 });
  }

  move() {
    this.tone(330, 0.04, { type: "sine", volume: 0.03, slideTo: 420 });
  }

  crash() {
    this.noise(0.6, 0.35, 900);
    this.tone(160, 0.5, { type: "sawtooth", volume: 0.08, slideTo: 40 });
  }

  record() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.16, { delay: 0.25 + i * 0.1, type: "triangle", volume: 0.1 }));
  }
}
