import { describe, expect, it } from "vitest";
import {
  createGame,
  distanceMeters,
  laneCenter,
  PLAYER_SIZE,
  rowGap,
  RULES,
  spawnRow,
  start,
  steer,
  step,
  WORLD,
  type Entity,
  type GameState,
} from "./engine";

const DT = 1 / 60;

function running(seed = 42): GameState {
  const game = createGame(seed);
  start(game);
  return game;
}

/** Pone un objeto justo sobre el carro del jugador. */
function placeOnPlayer(game: GameState, kind: Entity["kind"]) {
  game.entities.push({ id: 999, kind, lane: game.lane, x: game.playerX, y: WORLD.playerY, w: 30, h: 30, ownSpeed: 0 });
}

function run(game: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += DT) step(game, DT);
}

describe("movimiento", () => {
  it("no avanza hasta que empieza la partida ni en pausa", () => {
    const game = createGame(1);
    step(game, DT);
    expect(game.scroll).toBe(0);
    start(game);
    step(game, DT);
    expect(game.scroll).toBeGreaterThan(0);
    game.status = "paused";
    const before = game.scroll;
    step(game, DT);
    expect(game.scroll).toBe(before);
  });

  it("acelera con el tiempo hasta la velocidad máxima", () => {
    const game = running();
    game.entities = [];
    game.nextRowAt = Infinity; // sin obstáculos para esta prueba
    run(game, 10);
    expect(game.speed).toBeGreaterThan(RULES.startSpeed);
    run(game, 120);
    expect(game.speed).toBe(RULES.maxSpeed);
  });

  it("cuenta la distancia en metros", () => {
    const game = running();
    game.nextRowAt = Infinity;
    run(game, 2);
    expect(distanceMeters(game)).toBe(Math.floor(game.scroll / RULES.pxPerMeter));
    expect(distanceMeters(game)).toBeGreaterThan(50);
  });

  it("cambia de carril sin salirse de la vía", () => {
    const game = running();
    steer(game, -1);
    steer(game, -1);
    expect(game.lane).toBe(0);
    steer(game, 1);
    steer(game, 1);
    steer(game, 1);
    expect(game.lane).toBe(2);
    game.nextRowAt = Infinity;
    run(game, 0.5);
    expect(game.playerX).toBeCloseTo(laneCenter(2), 0);
  });
});

describe("filas de obstáculos", () => {
  it("siempre dejan un carril libre alcanzable", () => {
    const game = running(7);
    game.time = 120; // dificultad máxima
    for (let i = 0; i < 500; i++) {
      game.entities = [];
      const previousOpen = game.openLanes;
      spawnRow(game, 0);
      const obstacles = game.entities.filter((e) => e.kind !== "coin" && e.kind !== "arepa");
      const blocked = new Set(obstacles.map((e) => e.lane));
      expect(blocked.size).toBeLessThan(WORLD.lanes);
      expect(blocked.has(game.lastFreeLane)).toBe(false);
      // Alcanzable desde cualquier carril que quedó libre en la fila anterior
      for (const open of previousOpen) expect(Math.abs(game.lastFreeLane - open)).toBeLessThanOrEqual(1);
      // Si solo se bloquea el medio, no puede ser un vehículo
      if (obstacles.length === 1 && obstacles[0].lane === 1) expect(["pothole", "cone"]).toContain(obstacles[0].kind);
    }
  });

  it("las filas se acercan a medida que sube la velocidad", () => {
    expect(rowGap(RULES.startSpeed)).toBe(RULES.maxRowGap);
    expect(rowGap(RULES.maxSpeed)).toBe(RULES.minRowGap);
  });

  it("los premios aparecen en el carril libre", () => {
    const game = running(3);
    for (let i = 0; i < 200; i++) {
      game.entities = [];
      spawnRow(game, 0);
      for (const prize of game.entities.filter((e) => e.kind === "coin" || e.kind === "arepa")) {
        expect(prize.lane).toBe(game.lastFreeLane);
      }
    }
  });

  it("con la misma semilla genera la misma partida", () => {
    const a = running(123);
    const b = running(123);
    run(a, 5);
    run(b, 5);
    expect(a.entities.map((e) => [e.kind, e.lane])).toEqual(b.entities.map((e) => [e.kind, e.lane]));
  });
});

describe("colisiones", () => {
  it("chocar con un obstáculo termina la partida", () => {
    const game = running();
    placeOnPlayer(game, "pothole");
    const events = step(game, DT);
    expect(game.status).toBe("over");
    expect(game.crashedInto).toBe("pothole");
    expect(events).toContainEqual({ type: "crash", kind: "pothole" });
  });

  it("las monedas suman y desaparecen", () => {
    const game = running();
    placeOnPlayer(game, "coin");
    const events = step(game, DT);
    expect(game.coins).toBe(1);
    expect(events).toContainEqual({ type: "coin" });
    expect(game.entities.some((e) => e.id === 999)).toBe(false);
  });

  it("la arepa da un escudo que rompe obstáculos y luego se acaba", () => {
    const game = running();
    placeOnPlayer(game, "arepa");
    step(game, DT);
    expect(game.shield).toBeGreaterThan(RULES.shieldSeconds - 0.1);

    placeOnPlayer(game, "car");
    const events = step(game, DT);
    expect(game.status).toBe("running");
    expect(events).toContainEqual({ type: "smash", kind: "car" });
    expect(distanceMeters(game)).toBeGreaterThanOrEqual(RULES.shieldSmashBonus);

    game.nextRowAt = Infinity;
    game.entities = [];
    run(game, RULES.shieldSeconds + 0.5);
    expect(game.shield).toBe(0);
  });

  it("no choca con lo que está en otro carril", () => {
    const game = running();
    game.entities.push({ id: 5, kind: "car", lane: 0, x: laneCenter(0), y: WORLD.playerY, w: 40, h: 70, ownSpeed: 0 });
    step(game, DT);
    expect(game.status).toBe("running");
    expect(PLAYER_SIZE.w).toBeLessThan(laneCenter(1) - laneCenter(0));
  });
});

describe("una partida automática", () => {
  /**
   * Conductor sencillo: mira lo que viene y lo que tiene al lado, y solo cambia
   * de carril si el carril vecino está libre en ese momento. Si un conductor así
   * sobrevive, el juego nunca genera situaciones imposibles.
   */
  function drive(game: GameState) {
    const obstacles = game.entities.filter((e) => e.kind !== "coin" && e.kind !== "arepa");
    const inWindow = (lane: number, from: number, to: number) =>
      obstacles.some((e) => e.lane === lane && e.y > WORLD.playerY - from && e.y < WORLD.playerY + to);
    const danger = (lane: number) => inWindow(lane, 230, 75);
    const besideNow = (lane: number) => inWindow(lane, 95, 75);

    if (!danger(game.lane)) return;
    const target = [0, 1, 2]
      .filter((l) => !danger(l))
      .sort((a, b) => Math.abs(a - game.lane) - Math.abs(b - game.lane))[0];
    if (target === undefined) return;
    const next = game.lane + Math.sign(target - game.lane);
    if (!besideNow(next)) steer(game, (Math.sign(target - game.lane) as -1 | 1));
  }

  it("un conductor prudente sobrevive en muchas partidas distintas", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const game = running(seed);
      for (let t = 0; t < 120 && game.status === "running"; t += DT) {
        drive(game);
        step(game, DT);
      }
      expect({ seed, status: game.status, crashedInto: game.crashedInto }).toEqual({ seed, status: "running", crashedInto: undefined });
      expect(distanceMeters(game)).toBeGreaterThan(5000);
    }
  });
});
