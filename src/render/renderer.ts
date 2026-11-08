import { RULES, WORLD, LANE_WIDTH, type GameState } from "../game/engine";
import * as sprite from "./sprites";

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

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
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

  crash(x: number, y: number) {
    this.shake = 0.35;
    this.burst(x, y - 30, ["#f97316", "#fbbf24", "#9ca3af", "#ef4444"], 40, 1.4);
  }

  draw(state: GameState, dt: number) {
    const { ctx, canvas } = this;
    this.clock += dt;
    ctx.setTransform(canvas.width / WORLD.width, 0, 0, canvas.height / WORLD.height, 0, 0);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const m = this.shake * 14;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    this.drawRoad(state.scroll);
    this.drawSpeedLines(state);

    for (const e of state.entities) {
      if (e.y < -60 || e.y > WORLD.height + 60) continue;
      switch (e.kind) {
        case "pothole": sprite.pothole(ctx, e.x, e.y); break;
        case "cone": sprite.cone(ctx, e.x, e.y); break;
        case "moto": sprite.moto(ctx, e.x, e.y); break;
        case "car": sprite.car(ctx, e.x, e.y, e.color ?? "#94a3b8"); break;
        case "coin": sprite.coin(ctx, e.x, e.y, this.clock * 5 + e.id); break;
        case "star": sprite.star(ctx, e.x, e.y, this.clock); break;
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

    this.drawParticles(dt);
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
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
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
