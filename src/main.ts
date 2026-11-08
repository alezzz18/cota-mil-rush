import "./styles.css";
import { Sound } from "./audio";
import {
  CRASH_LABEL,
  createGame,
  distanceMeters,
  pause,
  speedKmh,
  start,
  steer,
  step,
  WORLD,
  type GameEvent,
  type GameState,
} from "./game/engine";
import { Renderer } from "./render/renderer";
import { load, save } from "./storage";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("canvas");
const renderer = new Renderer(canvas);
const saved = load();
const sound = new Sound(saved.muted);

const ui = {
  game: $("game"),
  hud: $("hud"),
  distance: $("hud-distance"),
  coins: $("hud-coins"),
  speed: $("hud-speed"),
  shield: $("hud-shield"),
  menu: $("menu"),
  paused: $("paused"),
  over: $("over"),
  best: $("best"),
  reason: $("over-reason"),
  result: $("over-distance"),
  record: $("over-record"),
  overCoins: $("over-coins"),
  overSpeed: $("over-speed"),
  toast: $("toast"),
  mute: $<HTMLButtonElement>("mute"),
};

let state: GameState = createGame();
let overTimer = 0;

/* ---------- Pantallas ---------- */
function show(screen: "menu" | "playing" | "paused" | "over") {
  ui.menu.hidden = screen !== "menu";
  ui.paused.hidden = screen !== "paused";
  ui.over.hidden = screen !== "over";
  ui.hud.hidden = screen === "menu";
  ui.game.dataset.screen = screen;
  const focus = { menu: "play", paused: "resume", over: "again", playing: "" }[screen];
  if (focus) $(focus).focus({ preventScroll: true });
}

function renderBest() {
  ui.best.textContent = saved.best ? `${saved.best.toLocaleString("es-VE")} m` : "—";
}

function updateMute() {
  ui.mute.textContent = sound.muted ? "🔇 Sonido apagado" : "🔊 Sonido encendido";
  ui.mute.setAttribute("aria-pressed", String(!sound.muted));
}

function play() {
  sound.unlock();
  clearTimeout(overTimer);
  state = createGame();
  start(state);
  show("playing");
}

function togglePause() {
  if (state.status === "running") {
    pause(state);
    show("paused");
  } else if (state.status === "paused") {
    start(state);
    show("playing");
  }
}

function gameOver() {
  const meters = distanceMeters(state);
  const isRecord = meters > saved.best;
  saved.games += 1;
  if (isRecord) saved.best = meters;
  save(saved);

  ui.reason.textContent = state.crashedInto ? CRASH_LABEL[state.crashedInto] : "";
  ui.result.textContent = `${meters.toLocaleString("es-VE")} m`;
  ui.record.hidden = !isRecord;
  ui.overCoins.textContent = String(state.coins);
  ui.overSpeed.textContent = String(speedKmh(state.maxSpeedReached));
  renderBest();
  if (isRecord) sound.record();
  show("over");
}

/* ---------- Eventos del juego ---------- */
function handle(events: GameEvent[]) {
  for (const event of events) {
    const x = state.playerX;
    switch (event.type) {
      case "coin":
        sound.coin();
        renderer.burst(x, WORLD.playerY - 30, ["#fbbf24", "#fde68a"], 8, 0.6);
        break;
      case "arepa":
        sound.arepa();
        renderer.burst(x, WORLD.playerY - 30, ["#fbbf24", "#e9c46a", "#ffffff"], 24, 0.9);
        toast("🫓 ¡Escudo de arepa por 5 segundos!");
        break;
      case "smash":
        sound.smash();
        renderer.burst(x, WORLD.playerY - 40, ["#9ca3af", "#f97316", "#fbbf24"], 18, 1);
        break;
      case "crash":
        sound.crash();
        navigator.vibrate?.([120, 60, 180]);
        renderer.crash(x, WORLD.playerY);
        overTimer = window.setTimeout(gameOver, 750);
        break;
      case "shield-end":
        break;
    }
  }
}

/* ---------- HUD ---------- */
let lastHud = "";
function updateHud() {
  const hud = `${distanceMeters(state)}|${state.coins}|${speedKmh(state.speed)}|${Math.ceil(state.shield)}`;
  if (hud === lastHud) return;
  lastHud = hud;
  ui.distance.textContent = `${distanceMeters(state).toLocaleString("es-VE")} m`;
  ui.coins.textContent = `🪙 ${state.coins}`;
  ui.speed.textContent = `${speedKmh(state.speed)} km/h`;
  ui.shield.hidden = state.shield <= 0;
  ui.shield.textContent = `🫓 escudo ${Math.ceil(state.shield)} s`;
}

let toastTimer = 0;
function toast(text: string) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.toast.classList.remove("show"), 2200);
}

/* ---------- Controles ---------- */
function move(direction: -1 | 1) {
  if (state.status !== "running") return;
  const before = state.lane;
  steer(state, direction);
  if (state.lane !== before) sound.move();
}

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "arrowleft" || key === "a") move(-1);
  else if (key === "arrowright" || key === "d") move(1);
  else if (key === "p" || key === "escape") togglePause();
  else if ((key === " " || key === "enter") && (!ui.menu.hidden || !ui.over.hidden)) {
    // Si un botón tiene el foco, el navegador ya lo activa; si no, Espacio/Enter empiezan
    if (document.activeElement instanceof HTMLButtonElement) return;
    play();
  } else return;
  e.preventDefault();
});

// Celular: deslizar o tocar a un lado de la pantalla
let touchStart: { x: number; t: number } | null = null;
canvas.addEventListener("pointerdown", (e) => {
  touchStart = { x: e.clientX, t: performance.now() };
});
canvas.addEventListener("pointerup", (e) => {
  if (!touchStart || state.status !== "running") return;
  const dx = e.clientX - touchStart.x;
  if (Math.abs(dx) > 24) move(dx < 0 ? -1 : 1);
  else {
    const rect = canvas.getBoundingClientRect();
    move(e.clientX < rect.left + rect.width / 2 ? -1 : 1);
  }
  touchStart = null;
});

$("play").addEventListener("click", play);
$("again").addEventListener("click", play);
$("resume").addEventListener("click", togglePause);
$("pause").addEventListener("click", togglePause);
$("to-menu").addEventListener("click", () => {
  state = createGame();
  show("menu");
});
ui.mute.addEventListener("click", () => {
  sound.muted = !sound.muted;
  saved.muted = sound.muted;
  save(saved);
  updateMute();
  sound.unlock();
});

$("share").addEventListener("click", async () => {
  const meters = distanceMeters(state).toLocaleString("es-VE");
  const url = location.origin + location.pathname;
  const text = `🚗💨 Recorrí ${meters} m en Cota Mil Rush esquivando huecos y motorizados. ¿Me superas?`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Cota Mil Rush", text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast("📋 Resultado copiado: pégalo donde quieras");
  } catch {
    /* el usuario canceló */
  }
});

// Pausa automática al cambiar de pestaña o minimizar
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.status === "running") togglePause();
});
window.addEventListener("resize", () => renderer.resize());

/* ---------- Bucle principal ---------- */
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.status === "ready") state.scroll += 90 * dt; // la vía se mueve detrás del menú
  handle(step(state, dt));
  renderer.draw(state, dt);
  if (state.status !== "ready") updateHud();
  requestAnimationFrame(frame);
}

// Solo con ?debug: deja leer el estado para las pruebas automáticas en el navegador
if (new URLSearchParams(location.search).has("debug")) {
  Object.defineProperty(window, "__game", { get: () => state });
}

renderBest();
updateMute();
show("menu");
requestAnimationFrame(frame);
