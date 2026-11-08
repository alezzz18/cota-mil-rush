/**
 * "Cota Mil Nights": música de fondo original estilo synthwave, generada en vivo con Web Audio.
 *
 * Capas: batería electrónica con caja grande y reverberación, bajo de sierra pulsante,
 * pad de acordes con voces desafinadas que "respira" con el bombo (sidechain), arpegio
 * con eco y una melodía principal. Progresión de 8 compases en La menor:
 *   Lam – Fa – Do – Sol – Lam – Fa – Sol – Mi
 *
 * - El tempo y la energía suben con la velocidad del carro; la melodía entra cuando ya vas rápido.
 * - Con la estrella sube un tono, acelera y la melodía va doblada a la octava.
 * - De noche: más reverberación y un filtro más oscuro.
 */

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** [bajo, ...pad] en notas MIDI */
const CHORDS = [
  [45, 57, 60, 64, 69], // Lam
  [41, 57, 60, 65, 69], // Fa
  [48, 55, 60, 64, 67], // Do
  [43, 55, 59, 62, 67], // Sol
  [45, 57, 60, 64, 69], // Lam
  [41, 57, 60, 65, 69], // Fa
  [43, 55, 59, 62, 67], // Sol
  [40, 56, 59, 64, 68], // Mi (tensión antes de volver)
];

const _ = -1;
/** Melodía original, una nota por semicorchea (_ = sigue sonando la anterior o silencio). */
const LEAD = [
  76, _, _, _, 81, _, _, 79, _, _, 76, _, 74, _, 76, _,
  77, _, _, _, 76, _, 74, _, 72, _, _, _, 69, _, 72, _,
  79, _, _, _, 76, _, _, 72, _, _, 79, _, 81, _, 79, _,
  74, _, _, _, 71, _, 74, _, 79, _, _, _, 78, _, _, _,
  76, _, _, _, 81, _, _, 83, _, _, 84, _, 83, _, 81, _,
  77, _, _, _, 81, _, 84, _, 86, _, _, _, 84, _, 81, _,
  83, _, _, _, 79, _, 83, _, 86, _, _, _, 83, _, _, _,
  80, _, _, _, 76, _, _, _, 83, _, _, _, 80, _, _, _,
];
const ARP = [1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 3, 2, 4, 3, 2, 3];

export type MusicMood = "day" | "night" | "star";

export class Music {
  private ctx?: AudioContext;
  private master?: GainNode;
  private tone?: BiquadFilterNode;
  private pump?: GainNode;
  private reverbSend?: GainNode;
  private delaySend?: GainNode;
  private timer = 0;
  private step = 0;
  private nextTime = 0;
  private playing = false;
  private noise?: AudioBuffer;
  /** 0 = velocidad inicial, 1 = velocidad máxima */
  intensity = 0;
  mood: MusicMood = "day";
  enabled: boolean;

  constructor(private getContext: () => AudioContext | undefined, enabled: boolean) {
    this.enabled = enabled;
  }

  /* ---------- Cadena de efectos ---------- */
  private setup() {
    const ctx = this.getContext();
    if (!ctx) return false;
    if (this.ctx === ctx) return true;
    this.ctx = ctx;

    // Salida: filtro de tono → compresor → volumen general
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    this.tone = ctx.createBiquadFilter();
    this.tone.type = "lowpass";
    this.tone.frequency.value = 12000;
    this.tone.connect(comp).connect(this.master).connect(ctx.destination);

    // Reverberación: respuesta de impulso sintética (ruido que se apaga en ~3 s, estéreo)
    const reverb = ctx.createConvolver();
    // En celulares una cola más corta: la convolución larga le cuesta mucho al procesador
    const seconds = window.matchMedia("(pointer: coarse)").matches ? 1.6 : 3;
    const ir = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2.6;
    }
    reverb.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(reverb).connect(this.tone);

    // Eco de corchea con puntillo, con filtro para que cada repetición sea más suave
    const delay = ctx.createDelay(2);
    const feedback = ctx.createGain();
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2600;
    feedback.gain.value = 0.38;
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.3;
    this.delaySend.connect(delay);
    delay.connect(damp).connect(feedback).connect(delay);
    damp.connect(this.tone);
    damp.connect(this.reverbSend);
    this.delay = delay;

    // "Bombeo": el pad y el bajo bajan un instante con cada bombo
    this.pump = ctx.createGain();
    this.pump.connect(this.tone);
    this.pump.connect(this.reverbSend);
    return true;
  }
  private delay?: DelayNode;

  start() {
    if (!this.enabled || this.playing || !this.setup()) return;
    const ctx = this.ctx!;
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.08;
    this.master!.gain.cancelScheduledValues(ctx.currentTime);
    this.master!.gain.setTargetAtTime(0.6, ctx.currentTime, 0.25);
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (!this.playing || !this.ctx) return;
    this.playing = false;
    clearInterval(this.timer);
    this.master!.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  reset() {
    this.step = 0;
  }

  setEnabled(on: boolean, playNow: boolean) {
    this.enabled = on;
    if (!on) this.stop();
    else if (playNow) this.start();
  }

  private get star() {
    return this.mood === "star";
  }

  private get tempo() {
    return 108 + this.intensity * 22 + (this.star ? 10 : 0);
  }

  private schedule() {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const night = this.mood === "night";
    this.tone!.frequency.setTargetAtTime(night ? 2400 : 12000, now, 0.8);
    this.reverbSend!.gain.setTargetAtTime(night ? 0.6 : 0.35, now, 0.8);
    this.delay!.delayTime.setTargetAtTime((60 / this.tempo) * 0.75, now, 0.2);
    while (this.nextTime < now + 0.15) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.tempo / 4;
      this.step = (this.step + 1) % 128;
    }
  }

  /* ---------- Un paso de semicorchea ---------- */
  private playStep(step: number, t: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const shift = this.star ? 2 : 0;
    const chord = CHORDS[bar];
    const six = 60 / this.tempo / 4;
    const energy = this.star ? 1 : this.intensity;

    // Batería
    const fourOnFloor = energy > 0.35;
    if (s === 0 || s === 8 || (fourOnFloor && (s === 4 || s === 12)) || (!fourOnFloor && s === 10)) this.kick(t);
    if (s === 4 || s === 12) this.snare(t);
    this.hat(t, s % 4 === 2 ? 0.06 : 0.025, s % 4 === 2 && energy > 0.5 ? 0.12 : 0.03);
    if (s === 12 && bar % 4 === 3) this.fill(t, six);

    // Pad: un acorde por compás, con ataque suave
    if (s === 0) for (const n of chord.slice(1)) this.pad(midi(n + shift), t, six * 16);

    // Bajo: corcheas, raíz y octava
    if (s % 2 === 0) this.bass(midi(chord[0] + shift + (s % 4 === 2 ? 12 : 0)), t, six * 1.7);

    // Arpegio brillante con eco
    if (energy > 0.15 || bar >= 4) this.pluck(midi(chord[ARP[s]] + shift + 12), t, six * 0.9, 0.022 + energy * 0.015);

    // Melodía principal: entra cuando ya vas rápido o con la estrella
    const note = LEAD[step];
    if (note > 0 && (this.star || this.intensity > 0.3)) {
      let length = 1;
      while (length < 6 && LEAD[(step + length) % 128] === _) length++;
      this.lead(midi(note + shift), t, six * length, this.star ? 0.085 : 0.06);
      if (this.star) this.lead(midi(note + shift + 12), t, six * length, 0.035);
    }
  }

  /* ---------- Instrumentos ---------- */
  private env(gain: GainNode, t: number, peak: number, attack: number, duration: number) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.setTargetAtTime(0.0001, t + Math.max(attack, duration - 0.05), duration * 0.25 + 0.04);
  }

  private osc(type: OscillatorType, freq: number, detune: number, t: number, end: number, out: AudioNode) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(out);
    o.start(t);
    o.stop(end);
  }

  /** Pad ancho: 3 sierras desafinadas, filtro que se abre poco a poco, pasa por el "bombeo". */
  private pad(freq: number, t: number, duration: number) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(2200, t + duration * 0.6);
    lp.Q.value = 2;
    const g = ctx.createGain();
    this.env(g, t, 0.022, 0.35, duration + 0.4);
    lp.connect(g).connect(this.pump!);
    for (const d of [-9, 0, 9]) this.osc("sawtooth", freq, d, t, t + duration + 1.2, lp);
  }

  private bass(freq: number, t: number, duration: number) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + duration);
    const g = ctx.createGain();
    this.env(g, t, 0.14, 0.006, duration);
    lp.connect(g).connect(this.pump!);
    this.osc("sawtooth", freq, -5, t, t + duration + 0.3, lp);
    this.osc("square", freq / 2, 5, t, t + duration + 0.3, lp);
  }

  private pluck(freq: number, t: number, duration: number, volume: number) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(5000, t);
    lp.frequency.exponentialRampToValueAtTime(600, t + duration);
    const g = ctx.createGain();
    this.env(g, t, volume, 0.004, duration);
    lp.connect(g);
    g.connect(this.tone!);
    g.connect(this.delaySend!);
    this.osc("square", freq, 0, t, t + duration + 0.3, lp);
  }

  /** Melodía: dos sierras desafinadas con vibrato, eco y reverberación: el "aura". */
  private lead(freq: number, t: number, duration: number, volume: number) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3800;
    const g = ctx.createGain();
    this.env(g, t, volume, 0.02, duration);
    lp.connect(g);
    g.connect(this.tone!);
    g.connect(this.delaySend!);
    g.connect(this.reverbSend!);
    const vibrato = ctx.createOscillator();
    const depth = ctx.createGain();
    vibrato.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(14, t + Math.min(0.4, duration));
    vibrato.connect(depth);
    for (const d of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.detune.value = d;
      depth.connect(o.detune);
      o.connect(lp);
      o.start(t);
      o.stop(t + duration + 0.6);
    }
    vibrato.start(t);
    vibrato.stop(t + duration + 0.6);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(this.tone!);
    o.start(t);
    o.stop(t + 0.35);
    // Sidechain: todo lo demás "respira" con el bombo
    const p = this.pump!.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(0.25, t);
    p.linearRampToValueAtTime(1, t + 0.26);
  }

  private noiseSource(t: number, duration: number) {
    const ctx = this.ctx!;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t);
    src.stop(t + duration + 0.05);
    return src;
  }

  /** Caja ochentera: ruido + cuerpo, con mucha reverberación. */
  private snare(t: number) {
    const ctx = this.ctx!;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    this.noiseSource(t, 0.25).connect(bp).connect(g);
    g.connect(this.tone!);
    const send = ctx.createGain();
    send.gain.value = 1.4;
    g.connect(send).connect(this.reverbSend!);
    const body = ctx.createOscillator();
    const bg = ctx.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(220, t);
    body.frequency.exponentialRampToValueAtTime(150, t + 0.1);
    bg.gain.setValueAtTime(0.18, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    body.connect(bg).connect(this.tone!);
    body.start(t);
    body.stop(t + 0.15);
  }

  private hat(t: number, duration: number, volume: number) {
    const ctx = this.ctx!;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 8000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    this.noiseSource(t, duration).connect(hp).connect(g).connect(this.tone!);
  }

  /** Redoble de toms en el último tiempo de cada frase de 4 compases. */
  private fill(t: number, six: number) {
    const ctx = this.ctx!;
    for (let i = 0; i < 4; i++) {
      const at = t + i * six;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(240 - i * 40, at);
      o.frequency.exponentialRampToValueAtTime(80, at + 0.18);
      g.gain.setValueAtTime(0.2, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      o.connect(g);
      g.connect(this.tone!);
      g.connect(this.reverbSend!);
      o.start(at);
      o.stop(at + 0.22);
    }
  }
}
