/**
 * Motor de Cota Mil Rush: estado y reglas del juego, sin dibujo ni DOM.
 * Todo avanza con `step(state, dt, events)`, así que se puede probar sin navegador.
 */

export const WORLD = {
  width: 300,
  height: 560,
  roadX: 50,
  roadWidth: 200,
  lanes: 3,
  playerY: 470,
} as const;

export const LANE_WIDTH = WORLD.roadWidth / WORLD.lanes;
export const laneCenter = (lane: number) => WORLD.roadX + LANE_WIDTH * lane + LANE_WIDTH / 2;

export const RULES = {
  startSpeed: 260, // px/s
  maxSpeed: 640,
  acceleration: 7, // px/s por segundo
  pxPerMeter: 10,
  kmhPerPx: 0.32, // para mostrar la velocidad
  laneChangeSpeed: 14, // qué tan rápido llega el carro a su carril
  minRowGap: 190, // px de pista entre filas de obstáculos (a velocidad máxima)
  maxRowGap: 300,
  shieldSeconds: 5,
  coinValue: 1,
  shieldSmashBonus: 25, // metros extra por romper un obstáculo con el escudo
} as const;

export type ObstacleKind = "pothole" | "cone" | "moto" | "car";
export type PickupKind = "coin" | "arepa";
export type EntityKind = ObstacleKind | PickupKind;

export interface Entity {
  id: number;
  kind: EntityKind;
  lane: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Velocidad propia hacia arriba (carros y motos también avanzan). */
  ownSpeed: number;
  color?: string;
}

export type Status = "ready" | "running" | "paused" | "over";

export interface GameState {
  status: Status;
  time: number;
  scroll: number;
  speed: number;
  maxSpeedReached: number;
  coins: number;
  bonus: number;
  shield: number;
  lane: number;
  playerX: number;
  entities: Entity[];
  nextRowAt: number;
  lastFreeLane: number;
  /** Carriles que quedaron libres en la última fila (el jugador puede estar en cualquiera). */
  openLanes: number[];
  crashedInto?: ObstacleKind;
  nextId: number;
  seed: number;
}

export type GameEvent =
  | { type: "coin" }
  | { type: "arepa" }
  | { type: "smash"; kind: ObstacleKind }
  | { type: "crash"; kind: ObstacleKind }
  | { type: "shield-end" };

const SIZES: Record<EntityKind, [number, number]> = {
  pothole: [44, 28],
  cone: [24, 24],
  moto: [16, 46],
  car: [40, 70],
  coin: [20, 20],
  arepa: [28, 28],
};

const CAR_COLORS = ["#f59e0b", "#16a34a", "#94a3b8", "#e11d48", "#7c3aed", "#f8fafc"];
export const PLAYER_SIZE = { w: 40, h: 70 };

/* ---------- Aleatoriedad reproducible (mulberry32) ---------- */
export function random(state: GameState): number {
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(state: GameState, items: readonly T[]): T => items[Math.floor(random(state) * items.length)];

/* ---------- Estado ---------- */
export function createGame(seed = Date.now()): GameState {
  return {
    status: "ready",
    time: 0,
    scroll: 0,
    speed: RULES.startSpeed,
    maxSpeedReached: RULES.startSpeed,
    coins: 0,
    bonus: 0,
    shield: 0,
    lane: 1,
    playerX: laneCenter(1),
    entities: [],
    nextRowAt: 260,
    lastFreeLane: 1,
    openLanes: [0, 1, 2],
    nextId: 1,
    seed: seed | 0,
  };
}

export const distanceMeters = (state: GameState) => Math.floor(state.scroll / RULES.pxPerMeter + state.bonus);
export const speedKmh = (speed: number) => Math.round(speed * RULES.kmhPerPx);

export function start(state: GameState) {
  if (state.status === "ready" || state.status === "paused") state.status = "running";
}

export function pause(state: GameState) {
  if (state.status === "running") state.status = "paused";
}

export function steer(state: GameState, direction: -1 | 1) {
  if (state.status !== "running") return;
  state.lane = Math.max(0, Math.min(WORLD.lanes - 1, state.lane + direction));
}

/* ---------- Generación de filas ---------- */
function spawn(state: GameState, kind: EntityKind, lane: number, y: number) {
  const [w, h] = SIZES[kind];
  state.entities.push({
    id: state.nextId++,
    kind,
    lane,
    x: laneCenter(lane),
    y,
    w,
    h,
    ownSpeed: kind === "car" ? 30 + random(state) * 30 : kind === "moto" ? 25 : 0,
    color: kind === "car" ? pick(state, CAR_COLORS) : undefined,
  });
}

/** Distancia entre filas: se acorta a medida que el juego acelera. */
export function rowGap(speed: number) {
  const progress = (speed - RULES.startSpeed) / (RULES.maxSpeed - RULES.startSpeed);
  return RULES.maxRowGap - (RULES.maxRowGap - RULES.minRowGap) * Math.min(1, Math.max(0, progress));
}

/**
 * Crea una fila de obstáculos. Reglas para que nunca sea imposible:
 * 1. Siempre queda al menos un carril libre.
 * 2. Ese carril está a un carril (o menos) de *todos* los que quedaron libres en
 *    la fila anterior, porque el jugador puede estar en cualquiera de ellos.
 * 3. No puede ser un carril donde todavía va un carro o una moto (bajan más lento).
 * 4. Si solo se bloquea el carril del medio, el obstáculo es fijo: un vehículo
 *    ahí se quedaría al lado del jugador e impediría cruzar.
 */
export function spawnRow(state: GameState, y = -90) {
  const candidates = [0, 1, 2].filter((lane) => state.openLanes.every((open) => Math.abs(open - lane) <= 1));
  const busy = new Set(state.entities.filter((e) => e.ownSpeed > 0 && e.y < 260).map((e) => e.lane));
  const safe = candidates.filter((l) => !busy.has(l));
  const freeLane = pick(state, safe.length ? safe : candidates);

  const blockedLanes = [0, 1, 2].filter((l) => l !== freeLane);
  const difficulty = Math.min(1, state.time / 60);
  const obstacleCount = random(state) < 0.35 + difficulty * 0.45 ? 2 : 1;
  const chosen = obstacleCount === 2 ? blockedLanes : [pick(state, blockedLanes)];

  for (const lane of chosen) {
    const onlyMiddle = chosen.length === 1 && lane === 1;
    const kinds = onlyMiddle
      ? (["pothole", "cone"] as const)
      : (["pothole", "pothole", "cone", "moto", "car", "car"] as const);
    spawn(state, pick(state, kinds), lane, y);
  }

  // Premios en el carril libre
  if (state.shield <= 0 && random(state) < 0.07) {
    spawn(state, "arepa", freeLane, y);
  } else if (random(state) < 0.55) {
    for (let i = 0; i < 3; i++) spawn(state, "coin", freeLane, y - i * 34);
  }
  state.lastFreeLane = freeLane;
  state.openLanes = [0, 1, 2].filter((l) => !chosen.includes(l));
}

/* ---------- Colisiones ---------- */
export function hits(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  // Se encoge un poco la caja para que los choques se sientan justos
  const shrink = 0.78;
  return (
    Math.abs(a.x - b.x) * 2 < (a.w + b.w) * shrink &&
    Math.abs(a.y - b.y) * 2 < (a.h + b.h) * shrink
  );
}

const isObstacle = (kind: EntityKind): kind is ObstacleKind => kind !== "coin" && kind !== "arepa";

/* ---------- Paso de simulación ---------- */
export function step(state: GameState, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.status !== "running") return events;
  dt = Math.min(dt, 1 / 20); // evita saltos si la pestaña se trabó

  state.time += dt;
  state.speed = Math.min(RULES.maxSpeed, RULES.startSpeed + state.time * RULES.acceleration);
  state.maxSpeedReached = Math.max(state.maxSpeedReached, state.speed);
  state.scroll += state.speed * dt;

  // El carro se desliza hacia el centro de su carril
  const target = laneCenter(state.lane);
  state.playerX += (target - state.playerX) * Math.min(1, RULES.laneChangeSpeed * dt);

  if (state.shield > 0) {
    state.shield = Math.max(0, state.shield - dt);
    if (state.shield === 0) events.push({ type: "shield-end" });
  }

  // Mover todo hacia abajo (los vehículos avanzan, así que bajan más lento)
  for (const e of state.entities) e.y += (state.speed - e.ownSpeed) * dt;

  // Nuevas filas según lo recorrido
  if (state.scroll >= state.nextRowAt) {
    spawnRow(state);
    state.nextRowAt = state.scroll + rowGap(state.speed);
  }

  // Colisiones
  const player = { x: state.playerX, y: WORLD.playerY, ...PLAYER_SIZE };
  for (const e of state.entities) {
    if (!hits(player, e)) continue;
    if (e.kind === "coin") {
      state.coins += RULES.coinValue;
      e.y = Infinity;
      events.push({ type: "coin" });
    } else if (e.kind === "arepa") {
      state.shield = RULES.shieldSeconds;
      e.y = Infinity;
      events.push({ type: "arepa" });
    } else if (isObstacle(e.kind)) {
      if (state.shield > 0) {
        state.bonus += RULES.shieldSmashBonus;
        e.y = Infinity;
        events.push({ type: "smash", kind: e.kind });
      } else {
        state.status = "over";
        state.crashedInto = e.kind;
        events.push({ type: "crash", kind: e.kind });
        break;
      }
    }
  }

  // Limpiar lo que ya salió de la pantalla
  state.entities = state.entities.filter((e) => e.y < WORLD.height + 120);
  return events;
}

export const CRASH_LABEL: Record<ObstacleKind, string> = {
  pothole: "¡Caíste en un hueco!",
  cone: "¡Te llevaste un cono!",
  moto: "¡Chocaste con un motorizado!",
  car: "¡Chocaste con otro carro!",
};
