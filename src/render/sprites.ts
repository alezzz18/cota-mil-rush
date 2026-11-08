/** Sprites dibujados con Canvas (sin imágenes): los mismos de la maqueta aprobada. */

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function pothole(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = "#1a1c20";
  ctx.beginPath();
  ctx.ellipse(x, y, 24, 15, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4b5059";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#0e0f12";
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 2, 13, 8, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // grietas
  ctx.strokeStyle = "#25282e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 22, y - 6);
  ctx.lineTo(x + 30, y - 10);
  ctx.moveTo(x - 20, y + 9);
  ctx.lineTo(x - 27, y + 14);
  ctx.stroke();
}

export function cone(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = "#1f2937";
  roundRect(ctx, x - 13, y - 13, 26, 26, 5);
  ctx.fill();
  for (const [r, color] of [[10, "#f97316"], [6, "#ffffff"], [3, "#f97316"]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function moto(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,.3)";
  roundRect(ctx, x - 6, y - 21, 14, 46, 6);
  ctx.fill();
  ctx.fillStyle = "#111";
  roundRect(ctx, x - 4, y - 24, 8, 12, 3);
  ctx.fill();
  roundRect(ctx, x - 4, y + 12, 8, 12, 3);
  ctx.fill();
  ctx.fillStyle = "#dc2626";
  roundRect(ctx, x - 7, y - 14, 14, 28, 6);
  ctx.fill();
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(x - 12, y - 12, 24, 3);
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.arc(x, y - 2, 7, 0, Math.PI * 2);
  ctx.fill();
}

export function car(ctx: Ctx, x: number, y: number, color: string, player = false) {
  ctx.fillStyle = "rgba(0,0,0,.35)";
  roundRect(ctx, x - 19, y - 33, 44, 72, 10);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x - 21, y - 36, 42, 72, 10);
  ctx.fill();
  ctx.fillStyle = "rgba(15,23,42,.85)";
  roundRect(ctx, x - 15, y - 20, 30, 16, 4);
  ctx.fill();
  roundRect(ctx, x - 14, y + 14, 28, 11, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.18)";
  roundRect(ctx, x - 13, y - 2, 26, 14, 4);
  ctx.fill();
  ctx.fillStyle = player ? "#fef9c3" : "#fecaca";
  ctx.fillRect(x - 17, y - 36, 8, 4);
  ctx.fillRect(x + 9, y - 36, 8, 4);
  if (player) {
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(x - 17, y + 33, 8, 3);
    ctx.fillRect(x + 9, y + 33, 8, 3);
    // franja deportiva
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillRect(x - 2, y - 36, 4, 16);
  }
}

export function coin(ctx: Ctx, x: number, y: number, spin: number) {
  const w = 10 * Math.abs(Math.cos(spin)) + 2;
  ctx.fillStyle = "#b45309";
  ctx.beginPath();
  ctx.ellipse(x, y + 1.5, w, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.ellipse(x, y, w, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  if (w > 6) {
    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", x, y + 1);
  }
}

/** Puntos de una estrella de 5 picos centrada en (x, y). */
function starPath(ctx: Ctx, x: number, y: number, outer: number, inner: number, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rotation - Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Premio: estrella que brilla, flota y se balancea. */
export function star(ctx: Ctx, x: number, y: number, time: number) {
  const bob = Math.sin(time * 5) * 3;
  const sway = Math.sin(time * 3) * 0.25;
  ctx.save();
  ctx.shadowColor = "#fde047";
  ctx.shadowBlur = 14 + Math.sin(time * 8) * 6;
  ctx.fillStyle = "#facc15";
  starPath(ctx, x, y + bob, 17, 7.5, sway);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#ca8a04";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  starPath(ctx, x, y + bob, 17, 7.5, sway);
  ctx.stroke();
  ctx.fillStyle = "#fef9c3";
  starPath(ctx, x - 2, y + bob - 3, 6, 2.6, sway);
  ctx.fill();
}

const RAINBOW = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#60a5fa", "#c084fc"];

/** Color del carro mientras es invencible: cambia de color sin parar (y vuelve al azul al final). */
export function rainbow(time: number, remaining: number) {
  if (remaining < 1.5 && Math.floor(time * 8) % 2 === 0) return "#2563eb";
  return RAINBOW[Math.floor(time * 14) % RAINBOW.length];
}

/** Brillo y destellos alrededor del carro invencible. */
export function starAura(ctx: Ctx, x: number, y: number, time: number, remaining: number) {
  const fading = remaining < 1.5;
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 8, x, y, 58);
  glow.addColorStop(0, `rgba(253,224,71,${fading ? 0.18 : 0.35})`);
  glow.addColorStop(1, "rgba(253,224,71,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 60, y - 60, 120, 120);
  // Destellos que giran alrededor
  for (let i = 0; i < 6; i++) {
    const a = time * 4 + (i * Math.PI) / 3;
    const sx = x + Math.cos(a) * 30;
    const sy = y + Math.sin(a) * 44;
    ctx.fillStyle = RAINBOW[(i + Math.floor(time * 10)) % RAINBOW.length];
    starPath(ctx, sx, sy, 5, 2, a);
    ctx.fill();
  }
  ctx.restore();
}
