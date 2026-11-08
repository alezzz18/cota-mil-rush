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
  starSeconds: 7,
  coinValue: 1,
  starSmashBonus: 25, // metros extra por romper un obstáculo siendo invencible
  stationGap: [5500, 8000], // px de vía entre estaciones de servicio
  firstStationAt: 3200,
  multiplierSeconds: 12,
  maxMultiplier: 5,
  nearMissBonus: 10, // metros por esquivar "por un pelo" (se multiplica por el combo)
  comboWindow: 3, // segundos para encadenar esquives
  /** Ciclo de día y noche en segundos: día, atardecer, noche, amanecer. */
  dayCycle: [40, 8, 45, 8],
} as const;

export type ObstacleKind = "pothole" | "cone" | "moto" | "car";
export type PickupKind = "coin" | "star" | "station";
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
  /** El jugador lo esquivó en el último momento (se cuenta al pasar). */
  dodged?: boolean;
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
  invincible: number;
  lane: number;
  playerX: number;
  entities: Entity[];
  nextRowAt: number;
  lastFreeLane: number;
  /** Carriles que quedaron libres en la última fila (el jugador puede estar en cualquiera). */
  openLanes: number[];
  crashedInto?: ObstacleKind;
  /** Multiplicador de monedas de las estaciones de servicio. */
  multiplier: number;
  multiplierTime: number;
  nextStationAt: number;
  combo: number;
  lastNearMissAt: number;
  nearMisses: number;
  bestCombo: number;
  nextId: number;
  seed: number;
}

export type GameEvent =
  | { type: "coin"; value: number }
  | { type: "station"; multiplier: number }
  | { type: "multiplier-end" }
  | { type: "near-miss"; combo: number; bonus: number }
  | { type: "star" }
  | { type: "smash"; kind: ObstacleKind }
  | { type: "crash"; kind: ObstacleKind }
  | { type: "star-end" };

const SIZES: Record<EntityKind, [number, number]> = {
  pothole: [44, 28],
  cone: [24, 24],
  moto: [16, 46],
  car: [40, 70],
  coin: [20, 20],
  star: [28, 28],
  station: [34, 40],
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
    invincible: 0,
    lane: 1,
    playerX: laneCenter(1),
    entities: [],
    nextRowAt: 260,
    lastFreeLane: 1,
    openLanes: [0, 1, 2],
    multiplier: 1,
    multiplierTime: 0,
    nextStationAt: RULES.firstStationAt,
    combo: 0,
    lastNearMissAt: -Infinity,
    nearMisses: 0,
    bestCombo: 0,
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
  const from = state.lane;
  state.lane = Math.max(0, Math.min(WORLD.lanes - 1, state.lane + direction));
  if (state.lane === from || state.invincible > 0) return;
  // ¿Estaba a punto de chocar con algo en el carril que deja? Eso es esquivar "por un pelo".
  for (const e of state.entities) {
    if (e.lane === from && isObstacle(e.kind) && e.y > WORLD.playerY - 125 && e.y < WORLD.playerY + 5) e.dodged = true;
  }
}

/**
 * Cuánta noche hay (0 = pleno día, 1 = noche cerrada) según el tiempo de partida.
 * El ciclo se repite: día → atardecer → noche → amanecer.
 */
export function nightAmount(time: number) {
  const [day, dusk, night, dawn] = RULES.dayCycle;
  const t = time % (day + dusk + night + dawn);
  if (t < day) return 0;
  if (t < day + dusk) return (t - day) / dusk;
  if (t < day + dusk + night) return 1;
  return 1 - (t - day - dusk - night) / dawn;
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

  // Premios en el carril libre. La estación de servicio va a la orilla: solo si el carril libre es uno de los lados.
  if (state.scroll >= state.nextStationAt && freeLane !== 1) {
    spawn(state, "station", freeLane, y);
    state.nextStationAt = state.scroll + RULES.stationGap[0] + random(state) * (RULES.stationGap[1] - RULES.stationGap[0]);
  } else if (state.invincible <= 0 && random(state) < 0.07) {
    spawn(state, "star", freeLane, y);
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

export const isObstacle = (kind: EntityKind): kind is ObstacleKind =>
  kind === "pothole" || kind === "cone" || kind === "moto" || kind === "car";

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

  if (state.invincible > 0) {
    state.invincible = Math.max(0, state.invincible - dt);
    if (state.invincible === 0) events.push({ type: "star-end" });
  }
  if (state.multiplierTime > 0) {
    state.multiplierTime = Math.max(0, state.multiplierTime - dt);
    if (state.multiplierTime === 0) {
      state.multiplier = 1;
      events.push({ type: "multiplier-end" });
    }
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
      const value = RULES.coinValue * state.multiplier;
      state.coins += value;
      e.y = Infinity;
      events.push({ type: "coin", value });
    } else if (e.kind === "station") {
      state.multiplier = Math.min(RULES.maxMultiplier, state.multiplier + 1);
      state.multiplierTime = RULES.multiplierSeconds;
      e.y = Infinity;
      events.push({ type: "station", multiplier: state.multiplier });
    } else if (e.kind === "star") {
      state.invincible = RULES.starSeconds;
      e.y = Infinity;
      events.push({ type: "star" });
    } else if (isObstacle(e.kind)) {
      if (state.invincible > 0) {
        state.bonus += RULES.starSmashBonus;
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

  // Esquives "por un pelo": cuentan cuando el obstáculo ya quedó atrás sin chocar
  if (state.status === "running") {
    for (const e of state.entities) {
      if (!e.dodged || !Number.isFinite(e.y) || e.y < WORLD.playerY + 50) continue;
      e.dodged = false;
      state.combo = state.time - state.lastNearMissAt <= RULES.comboWindow ? state.combo + 1 : 1;
      state.lastNearMissAt = state.time;
      state.nearMisses += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      const bonus = RULES.nearMissBonus * state.combo;
      state.bonus += bonus;
      events.push({ type: "near-miss", combo: state.combo, bonus });
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
