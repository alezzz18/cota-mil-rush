import { RULES, WORLD, LANE_WIDTH, nightAmount, type GameState } from "../game/engine";
import * as sprite from "./sprites";

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  total: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

/** Dibuja el estado del juego en un canvas, ajustado a la densidad de la pantalla. */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private shake = 0;
  private clock = 0;
  private texts: FloatingText[] = [];
  private flashColor = "#fff";
  private flashTime = 0;
  /** Capa de oscuridad de la noche: se le "recortan" las luces. Va a media resolución (es todo difuminado). */
  private shadeCanvas = document.createElement("canvas");
  private beamShade?: CanvasGradient;
  private beamLight?: CanvasGradient;

  /**
   * Calidad adaptable: resolución del canvas por cada píxel CSS. En celulares se empieza más bajo
   * y, si el equipo no aguanta, se baja sola un escalón más (nunca por debajo de 1).
   */
  private static readonly QUALITY = [2, 1.5, 1.25, 1];
  private quality = 0;
  private slowFrames = 0;
  private sampledFrames = 0;

  constructor(private canvas: HTMLCanvasElement) {
    // Sin transparencia: el navegador no tiene que mezclar el canvas con lo que hay detrás
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    const dpr = window.devicePixelRatio || 1;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const start = Math.min(dpr, touch ? 1.5 : 2);
    this.quality = Renderer.QUALITY.findIndex((q) => q <= start);
    if (this.quality < 0) this.quality = Renderer.QUALITY.length - 1;
    this.resize();
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, Renderer.QUALITY[this.quality]);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
  }

  /** Mide los cuadros mientras se juega: si más de la mitad van lentos (< 45 fps), baja la resolución. */
  private adapt(dt: number, running: boolean) {
    if (!running || this.quality >= Renderer.QUALITY.length - 1) return;
    this.sampledFrames++;
    if (dt > 1 / 45) this.slowFrames++;
    if (this.sampledFrames < 90) return;
    if (this.slowFrames > this.sampledFrames / 2) {
      this.quality++;
      this.resize();
    }
    this.sampledFrames = this.slowFrames = 0;
  }

  /** Resolución actual (para pruebas y depuración). */
  get pixelRatio() {
    return Math.min(window.devicePixelRatio || 1, Renderer.QUALITY[this.quality]);
  }

  burst(x: number, y: number, colors: string[], count: number, force = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (60 + Math.random() * 180) * force;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        color: colors[i % colors.length],
        size: 2 + Math.random() * 3,
      });
    }
  }

  /** Texto que sube y se desvanece (monedas, combos, avisos). */
  pop(x: number, y: number, text: string, color = "#fde68a", size = 14) {
    this.texts.push({ x, y, text, color, size, life: 1, total: 1 });
  }

  /** Monedas seguidas: un solo contador que crece ("+3", "+6", "+9") en vez de textos encimados. */
  popCoins(x: number, y: number, value: number, big: boolean) {
    const last = this.texts.find((t) => t.text.startsWith("+") && t.text.endsWith("🪙") && t.total - t.life < 0.45);
    if (last) {
      last.text = `+${Number.parseInt(last.text.slice(1)) + value} 🪙`;
      last.life = last.total - 0.05;
      last.x = x;
      return;
    }
    this.pop(x, y, `+${value} 🪙`, "#fde68a", big ? 17 : 13);
  }

  flash(color: string, seconds = 0.25) {
    this.flashColor = color;
    this.flashTime = seconds;
  }

  /** Confeti que cae desde arriba de la pantalla. */
  confetti() {
    const colors = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#60a5fa", "#c084fc", "#ffffff"];
    for (let i = 0; i < 70; i++) {
      this.particles.push({
        x: Math.random() * WORLD.width,
        y: -10 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 60,
        vy: 60 + Math.random() * 120,
        life: 1.4 + Math.random() * 0.8,
        color: colors[i % colors.length],
        size: 3 + Math.random() * 3,
      });
    }
  }

  crash(x: number, y: number) {
    this.shake = 0.35;
    this.burst(x, y - 30, ["#f97316", "#fbbf24", "#9ca3af", "#ef4444"], 40, 1.4);
  }

  draw(state: GameState, dt: number) {
    const { ctx, canvas } = this;
    this.clock += dt;
    this.adapt(dt, state.status === "running");
    ctx.setTransform(canvas.width / WORLD.width, 0, 0, canvas.height / WORLD.height, 0, 0);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const m = this.shake * 14;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    this.drawRoad(state.scroll);
    this.drawSpeedLines(state);

    // Estaciones de servicio a la orilla, debajo de todo lo que va en la vía
    for (const e of state.entities) {
      if (e.kind !== "station" || e.y < -120 || e.y > WORLD.height + 120) continue;
      if (e.lane === 0) sprite.station(ctx, -1, WORLD.roadX - 6, e.y);
      else sprite.station(ctx, 1, WORLD.roadX + WORLD.roadWidth + 6, e.y);
    }

    for (const e of state.entities) {
      if (e.y < -60 || e.y > WORLD.height + 60) continue;
      switch (e.kind) {
        case "pothole": sprite.pothole(ctx, e.x, e.y); break;
        case "cone": sprite.cone(ctx, e.x, e.y); break;
        case "moto": sprite.moto(ctx, e.x, e.y); break;
        case "car": sprite.car(ctx, e.x, e.y, e.color ?? "#94a3b8"); break;
        case "coin": sprite.coin(ctx, e.x, e.y, this.clock * 5 + e.id); break;
        case "star": sprite.star(ctx, e.x, e.y, this.clock); break;
        case "station": sprite.pump(ctx, e.x, e.y, this.clock, Math.min(RULES.maxMultiplier, state.multiplier + 1)); break;
      }
    }

    const invincible = state.invincible > 0;
    if (invincible) sprite.starAura(ctx, state.playerX, WORLD.playerY, this.clock, state.invincible);
    // Inclinación al cambiar de carril
    const tilt = Math.max(-0.18, Math.min(0.18, (state.playerX - (WORLD.roadX + LANE_WIDTH * state.lane + LANE_WIDTH / 2)) * -0.006));
    ctx.save();
    ctx.translate(state.playerX, WORLD.playerY);
    ctx.rotate(tilt);
    sprite.car(ctx, 0, 0, invincible ? sprite.rainbow(this.clock, state.invincible) : "#2563eb", true);
    ctx.restore();

    this.drawNight(state);
    this.drawParticles(dt);
    this.drawTexts(dt);

    if (this.flashTime > 0) {
      this.flashTime = Math.max(0, this.flashTime - dt);
      ctx.globalAlpha = this.flashTime * 1.2;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(-20, -20, WORLD.width + 40, WORLD.height + 40);
      ctx.globalAlpha = 1;
    }
  }

  /** Atardecer naranja, oscuridad de noche y luces: faros, farolas, luces traseras y reflejos. */
  private drawNight(state: GameState) {
    const night = state.status === "ready" ? 0 : nightAmount(state.time);
    if (night <= 0) return;
    const { ctx, canvas } = this;
    const { roadX, roadWidth, playerY } = WORLD;

    // Tono de atardecer/amanecer mezclado con la oscuridad en una sola capa (una pasada menos por cuadro)
    const tint = 0.2 * Math.sin(Math.PI * night);
    const dark = 0.78 * night;
    const alpha = 1 - (1 - tint) * (1 - dark);
    const mix = (orange: number, navy: number) => Math.round((orange * tint * (1 - dark) + navy * dark) / alpha);
    const shade = `rgba(${mix(251, 5)},${mix(146, 9)},${mix(60, 26)},${alpha.toFixed(3)})`;

    const sc = this.shadeCanvas;
    const sw = Math.max(1, Math.round(canvas.width / 2));
    const sh = Math.max(1, Math.round(canvas.height / 2));
    let s = sc.getContext("2d")!;
    if (sc.width !== sw || sc.height !== sh) {
      sc.width = sw;
      sc.height = sh;
      s = sc.getContext("2d")!;
      this.beamShade = undefined;
    }
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = "copy";
    s.fillStyle = shade;
    s.fillRect(0, 0, sw, sh);
    s.setTransform(sw / WORLD.width, 0, 0, sh / WORLD.height, 0, 0);

    s.globalCompositeOperation = "destination-out";
    const light = (x: number, y: number, r: number, strength: number) => sprite.glow(s, x, y, r, "#000", strength);
    const lampYs: number[] = [];
    for (let y = state.scroll % 120; y < WORLD.height + 60; y += 120) lampYs.push(y);
    for (const y of lampYs) for (const x of [roadX - 7, roadX + roadWidth + 7]) light(x, y, 58, 0.8);
    // Lo que hay en la vía tiene reflectores: siempre se alcanza a ver
    for (const e of state.entities) {
      if (e.y < -90 || e.y > WORLD.height + 90) continue;
      const pickup = e.kind === "coin" || e.kind === "star" || e.kind === "station";
      light(e.x, e.y, pickup ? 34 : 30, pickup ? 0.85 : 0.45);
      if (e.kind === "station") light(e.lane === 0 ? roadX - 23 : roadX + roadWidth + 23, e.y, 80, 0.9);
    }
    // Faros del jugador (el degradado es vertical y fijo: se crea una sola vez)
    if (!this.beamShade || !this.beamLight) {
      const make = (target: CanvasRenderingContext2D, rgb: string) => {
        const g = target.createLinearGradient(0, playerY - 34, 0, playerY - 270);
        g.addColorStop(0, `rgba(${rgb},1)`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        return g;
      };
      this.beamShade = make(s, "0,0,0");
      this.beamLight = make(ctx, "255,244,200");
    }
    const beam = (target: CanvasRenderingContext2D, alpha: number) => {
      const x = state.playerX;
      target.globalAlpha = alpha;
      target.fillStyle = target === s ? this.beamShade! : this.beamLight!;
      target.beginPath();
      target.moveTo(x - 14, playerY - 32);
      target.lineTo(x + 14, playerY - 32);
      target.lineTo(x + 62, playerY - 270);
      target.lineTo(x - 62, playerY - 270);
      target.closePath();
      target.fill();
      target.globalAlpha = 1;
    };
    beam(s, 1);
    light(state.playerX, playerY, 46, 0.9);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sc, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Brillos que suman luz encima de la oscuridad
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    beam(ctx, 0.16 * night);
    const AMBER = "rgb(253,230,138)", RED = "rgb(248,40,40)";
    for (const y of lampYs) for (const x of [roadX - 7, roadX + roadWidth + 7]) sprite.glow(ctx, x, y, 14, AMBER, 0.7 * night);
    for (const e of state.entities) {
      if ((e.kind === "car" || e.kind === "moto") && e.y > -60 && e.y < WORLD.height + 60) {
        const back = e.y + e.h / 2 - 3;
        if (e.kind === "moto") sprite.glow(ctx, e.x, back, 12, RED, 0.85 * night);
        else for (const dx of [-13, 13]) sprite.glow(ctx, e.x + dx, back, 12, RED, 0.85 * night);
      }
    }
    for (const dx of [-13, 13]) sprite.glow(ctx, state.playerX + dx, playerY + 33, 10, RED, 0.7 * night);
    ctx.restore();
  }

  private drawTexts(dt: number) {
    const { ctx } = this;
    this.texts = this.texts.filter((t) => (t.life -= dt) > 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const t of this.texts) {
      const age = t.total - t.life;
      const scale = age < 0.12 ? 0.6 + (age / 0.12) * 0.5 : 1.1 - Math.min(0.1, (age - 0.12) * 0.5);
      const y = t.y - age * 45;
      ctx.globalAlpha = Math.min(1, t.life * 2.5);
      ctx.font = `800 ${Math.round(t.size * scale)}px "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.strokeStyle = "rgba(11,13,16,.85)";
      ctx.lineWidth = 4;
      ctx.strokeText(t.text, t.x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, y);
    }
    ctx.globalAlpha = 1;
  }

  private drawRoad(scroll: number) {
    const { ctx } = this;
    const { width: W, height: H, roadX, roadWidth } = WORLD;

    ctx.fillStyle = "#2f5d3a";
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.fillStyle = "#9aa3ad";
    ctx.fillRect(roadX - 14, -20, 14, H + 40);
    ctx.fillRect(roadX + roadWidth, -20, 14, H + 40);
    ctx.fillStyle = "#87909b";
    for (let y = (scroll % 28) - 28; y < H; y += 28) {
      ctx.fillRect(roadX - 14, y, 14, 1);
      ctx.fillRect(roadX + roadWidth, y, 14, 1);
    }

    // Árboles y faroles (pasan al ritmo de la vía)
    for (let y = (scroll % 120) - 60; y < H + 60; y += 120) {
      for (const x of [16, W - 16]) {
        ctx.fillStyle = "#24492d";
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3e7a4c";
        ctx.beginPath();
        ctx.arc(x - 3, y - 3, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#fde68a";
      for (const x of [roadX - 7, roadX + roadWidth + 7]) {
        ctx.beginPath();
        ctx.arc(x, y + 60, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const gradient = ctx.createLinearGradient(roadX, 0, roadX + roadWidth, 0);
    gradient.addColorStop(0, "#2b2f36");
    gradient.addColorStop(0.5, "#353a42");
    gradient.addColorStop(1, "#2b2f36");
    ctx.fillStyle = gradient;
    ctx.fillRect(roadX, -20, roadWidth, H + 40);

    ctx.fillStyle = "#facc15";
    ctx.fillRect(roadX + 3, -20, 3, H + 40);
    ctx.fillRect(roadX + roadWidth - 6, -20, 3, H + 40);
    ctx.fillStyle = "#e5e7eb";
    for (let lane = 1; lane < WORLD.lanes; lane++) {
      for (let y = (scroll % 48) - 48; y < H; y += 48) ctx.fillRect(roadX + LANE_WIDTH * lane - 1.5, y, 3, 24);
    }
  }

  private drawSpeedLines(state: GameState) {
    const intensity = (state.speed - RULES.startSpeed) / (RULES.maxSpeed - RULES.startSpeed);
    if (intensity < 0.15 || state.status !== "running") return;
    const { ctx } = this;
    ctx.strokeStyle = `rgba(255,255,255,${0.06 + intensity * 0.12})`;
    ctx.lineWidth = 2;
    const offset = (state.scroll * 1.6) % WORLD.height;
    for (const [x, y, l] of [[70, 120, 40], [228, 200, 50], [120, 300, 35], [210, 420, 45], [80, 480, 30], [180, 40, 40]]) {
      const yy = (y + offset) % WORLD.height;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x, yy + l * (0.6 + intensity));
      ctx.stroke();
    }
  }

  private drawParticles(dt: number) {
    const { ctx } = this;
    let alive = 0;
    for (const p of this.particles) if ((p.life -= dt) > 0) this.particles[alive++] = p;
    this.particles.length = alive;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
