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

export function arepa(ctx: Ctx, x: number, y: number, pulse: number) {
  ctx.save();
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 10 + Math.sin(pulse * 6) * 6;
  ctx.fillStyle = "#e9c46a";
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#a16207";
  ctx.lineWidth = 2;
  for (const d of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.moveTo(x - 9, y + d);
    ctx.lineTo(x + 9, y + d);
    ctx.stroke();
  }
  ctx.fillStyle = "#f4dba0";
  ctx.beginPath();
  ctx.arc(x - 4, y - 4, 4, 0, Math.PI * 2);
  ctx.fill();
}

export function shield(ctx: Ctx, x: number, y: number, time: number, remaining: number) {
  // Parpadea cuando está por acabarse
  if (remaining < 1.2 && Math.floor(time * 10) % 2 === 0) return;
  ctx.save();
  ctx.strokeStyle = "rgba(251,191,36,.85)";
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -time * 40;
  ctx.beginPath();
  ctx.ellipse(x, y, 34, 48, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(251,191,36,.1)";
  ctx.fill();
  ctx.restore();
}
