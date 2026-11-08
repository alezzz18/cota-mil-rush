/**
 * Música de fondo original, generada en vivo con Web Audio (sin archivos).
 * Un secuenciador de 16 pasos con batería, bajo y arpegio sobre Lam – Fa – Do – Sol.
 * - El tempo sube con la velocidad del carro.
 * - Con la estrella sube de tono y el arpegio corre al doble.
 * - De noche un filtro la vuelve más oscura.
 */

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Acordes en notas MIDI: [bajo, ...arpegio] */
const CHORDS = [
  [45, 57, 60, 64, 69], // La menor
  [41, 53, 57, 60, 65], // Fa
  [48, 55, 60, 64, 67], // Do
  [43, 55, 59, 62, 67], // Sol
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2];
const LEAD = [76, -1, 74, 72, -1, 72, 69, -1, 72, -1, 74, 76, -1, 79, 76, -1]; // gancho que entra con la estrella

export type MusicMood = "day" | "night" | "star";

export class Music {
  private ctx?: AudioContext;
  private bus?: GainNode;
  private filter?: BiquadFilterNode;
  private timer = 0;
  private step = 0;
  private nextTime = 0;
  private playing = false;
  /** 0 = velocidad inicial, 1 = velocidad máxima */
  intensity = 0;
  mood: MusicMood = "day";
  enabled: boolean;

  constructor(private getContext: () => AudioContext | undefined, enabled: boolean) {
    this.enabled = enabled;
  }

  private setup() {
    const ctx = this.getContext();
    if (!ctx) return false;
    if (this.ctx === ctx) return true;
    this.ctx = ctx;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 9000;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.filter.connect(this.bus).connect(ctx.destination);
    return true;
  }

  start() {
    if (!this.enabled || this.playing || !this.setup()) return;
    const ctx = this.ctx!;
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.06;
    this.bus!.gain.cancelScheduledValues(ctx.currentTime);
    this.bus!.gain.setTargetAtTime(0.55, ctx.currentTime, 0.15);
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (!this.playing || !this.ctx) return;
    this.playing = false;
    clearInterval(this.timer);
    this.bus!.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
  }

  /** Vuelve a empezar desde el primer compás (nueva partida). */
  reset() {
    this.step = 0;
  }

  setEnabled(on: boolean, playNow: boolean) {
    this.enabled = on;
    if (!on) this.stop();
    else if (playNow) this.start();
  }

  private get tempo() {
    return 124 + this.intensity * 28 + (this.mood === "star" ? 14 : 0);
  }

  private schedule() {
    const ctx = this.ctx!;
    // Filtro: más oscuro de noche
    const cutoff = this.mood === "night" ? 1300 : 9000;
    this.filter!.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.6);
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.tempo / 4;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number) {
    const s = step % 16;
    const star = this.mood === "star";
    const shift = star ? 5 : 0;
    const chord = CHORDS[Math.floor(step / 16) % 4];
    const sixteenth = 60 / this.tempo / 4;

    // Batería
    if (s % 4 === 0) this.kick(t);
    if (s === 4 || s === 12) this.hat(t, 0.16, 0.12, 1800); // caja
    if (s % 2 === 1 || this.intensity > 0.5) this.hat(t, 0.035, 0.05, 7000);

    // Bajo: octavas a corcheas
    if (s % 2 === 0) this.voice(midi(chord[0] + shift + (s % 4 === 2 ? 12 : 0)), t, sixteenth * 1.6, "sawtooth", 0.09, 900);

    // Arpegio (doble de rápido con la estrella)
    const arpNote = chord[1 + ARP[s]] + shift + 12;
    this.voice(midi(arpNote), t, sixteenth * 0.9, "square", 0.028 + this.intensity * 0.012, 4000);
    if (star) this.voice(midi(chord[1 + ARP[(s + 2) % 16]] + shift + 24), t + sixteenth / 2, sixteenth * 0.45, "square", 0.022, 6000);

    // Melodía: entra con la estrella y en la segunda mitad cuando ya vas rápido
    if ((star || (this.intensity > 0.35 && step >= 32)) && LEAD[s] > 0) {
      this.voice(midi(LEAD[s] + shift), t, sixteenth * 1.8, "triangle", 0.07, 5000);
    }
  }

  private voice(freq: number, t: number, duration: number, type: OscillatorType, volume: number, cutoff: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    lp.type = "lowpass";
    lp.frequency.value = cutoff;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(lp).connect(gain).connect(this.filter!);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(this.filter!);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private noiseBuffer?: AudioBuffer;
  private hat(t: number, duration: number, volume: number, highpass: number) {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = this.noiseBuffer;
    hp.type = "highpass";
    hp.frequency.value = highpass;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(hp).connect(gain).connect(this.filter!);
    src.start(t);
    src.stop(t + duration + 0.02);
  }
}
