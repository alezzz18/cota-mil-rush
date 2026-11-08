import "./styles.css";
import { Sound } from "./audio";
import { Music } from "./music";
import {
  CRASH_LABEL,
  createGame,
  distanceMeters,
  nightAmount,
  pause,
  RULES,
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
const music = new Music(() => sound.context, !saved.musicOff);

const ui = {
  game: $("game"),
  hud: $("hud"),
  distance: $("hud-distance"),
  coins: $("hud-coins"),
  speed: $("hud-speed"),
  star: $("hud-star"),
  overNear: $("over-near"),
  musicBtn: $<HTMLButtonElement>("music"),
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
let nextMilestone = 500;
let wasNight = false;

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
  ui.mute.textContent = sound.muted ? "🔇 Sin sonido" : "🔊 Sonido";
  ui.mute.setAttribute("aria-pressed", String(!sound.muted));
}

function updateMusicButton() {
  ui.musicBtn.textContent = music.enabled ? "🎵 Música" : "🎵 Sin música";
  ui.musicBtn.setAttribute("aria-pressed", String(music.enabled));
}

function play() {
  sound.unlock();
  clearTimeout(overTimer);
  state = createGame();
  start(state);
  nextMilestone = 500;
  wasNight = false;
  music.reset();
  music.mood = "day";
  music.start();
  show("playing");
}

function togglePause() {
  if (state.status === "running") {
    pause(state);
    music.stop();
    show("paused");
  } else if (state.status === "paused") {
    start(state);
    music.start();
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
  ui.overNear.textContent = String(state.nearMisses);
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
        renderer.popCoins(x, WORLD.playerY - 52, event.value, event.value > 1);
        break;
      case "station":
        sound.station(event.multiplier);
        renderer.burst(x, WORLD.playerY - 30, ["#38bdf8", "#2563eb", "#facc15", "#ffffff"], 26, 1);
        renderer.flash("#38bdf8", 0.2);
        renderer.pop(x, WORLD.playerY - 70, `⛽ ×${event.multiplier}`, "#7dd3fc", 22);
        toast(`⛽ ¡Monedas ×${event.multiplier} por ${RULES.multiplierSeconds} segundos!`);
        break;
      case "multiplier-end":
        renderer.pop(WORLD.width / 2, 120, "Multiplicador terminado", "#98a2ae", 11);
        break;
      case "near-miss": {
        sound.nearMiss(event.combo);
        const hot = event.combo >= 3;
        renderer.pop(x, WORLD.playerY - 75, event.combo > 1 ? `¡Por un pelo! ×${event.combo}` : "¡Por un pelo!", hot ? "#f472b6" : "#7dd3fc", 13 + Math.min(event.combo, 5) * 2);
        renderer.pop(x, WORLD.playerY - 52, `+${event.bonus} m`, "#e7eaee", 11);
        if (hot) renderer.flash("#f472b6", 0.15);
        break;
      }
      case "star":
        sound.star();
        renderer.burst(x, WORLD.playerY - 30, ["#fbbf24", "#f472b6", "#60a5fa", "#34d399", "#ffffff"], 30, 1);
        toast("⭐ ¡Invencible por 7 segundos!");
        break;
      case "smash":
        sound.smash();
        renderer.burst(x, WORLD.playerY - 40, ["#9ca3af", "#f97316", "#fbbf24"], 18, 1);
        break;
      case "crash":
        sound.crash();
        music.stop();
        navigator.vibrate?.([120, 60, 180]);
        renderer.crash(x, WORLD.playerY);
        overTimer = window.setTimeout(gameOver, 750);
        break;
      case "star-end":
        break;
    }
  }
}

/* ---------- HUD ---------- */
let lastHud = "";
function updateHud() {
  const hud = `${distanceMeters(state)}|${state.coins}|${speedKmh(state.speed)}|${Math.ceil(state.invincible)}|${state.multiplier}|${Math.ceil(state.multiplierTime)}`;
  if (hud === lastHud) return;
  lastHud = hud;
  ui.distance.textContent = `${distanceMeters(state).toLocaleString("es-VE")} m`;
  const boosted = state.multiplier > 1;
  ui.coins.textContent = boosted ? `🪙 ${state.coins} · ×${state.multiplier} ${Math.ceil(state.multiplierTime)}s` : `🪙 ${state.coins}`;
  ui.coins.classList.toggle("multi", boosted);
  ui.speed.textContent = `${speedKmh(state.speed)} km/h`;
  ui.star.hidden = state.invincible <= 0;
  ui.star.textContent = `⭐ invencible ${Math.ceil(state.invincible)} s`;
}

// Los avisos hacen fila para que uno no tape al otro
const toasts: string[] = [];
let toastBusy = false;
function toast(text: string) {
  if (toasts.length < 3) toasts.push(text);
  if (!toastBusy) nextToast();
}
function nextToast() {
  const text = toasts.shift();
  if (!text) {
    toastBusy = false;
    ui.toast.classList.remove("show");
    return;
  }
  toastBusy = true;
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  window.setTimeout(nextToast, toasts.length ? 1500 : 2000);
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
  music.stop();
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
ui.musicBtn.addEventListener("click", () => {
  sound.unlock();
  saved.musicOff = music.enabled;
  save(saved);
  music.setEnabled(!music.enabled, state.status === "running");
  updateMusicButton();
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

/* ---------- Ambiente: música, noche y metas ---------- */
function ambience() {
  const night = nightAmount(state.time);
  music.intensity = (state.speed - RULES.startSpeed) / (RULES.maxSpeed - RULES.startSpeed);
  music.mood = state.invincible > 0 ? "star" : night > 0.5 ? "night" : "day";
  const isNight = night > 0.5;
  if (isNight !== wasNight) {
    wasNight = isNight;
    toast(isNight ? "🌙 Se hizo de noche: ¡prende los faros!" : "☀️ ¡Amaneció en la Cota Mil!");
  }
  const meters = distanceMeters(state);
  if (meters >= nextMilestone) {
    sound.milestone();
    renderer.confetti();
    renderer.pop(WORLD.width / 2, 200, `🏁 ${nextMilestone.toLocaleString("es-VE")} m`, "#facc15", 26);
    nextMilestone += 500;
  }
}

/* ---------- Bucle principal ---------- */
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.status === "ready") state.scroll += 90 * dt; // la vía se mueve detrás del menú
  handle(step(state, dt));
  if (state.status === "running") ambience();
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
updateMusicButton();
show("menu");
requestAnimationFrame(frame);
