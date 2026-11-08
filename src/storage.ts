/** Récord y preferencias en localStorage (si no hay almacenamiento, el juego sigue). */
const KEY = "cota-mil-rush:v1";

export interface Saved {
  best: number;
  games: number;
  muted: boolean;
  musicOff: boolean;
}

export function load(): Saved {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Saved>;
    return { best: Number(data.best) || 0, games: Number(data.games) || 0, muted: Boolean(data.muted), musicOff: Boolean(data.musicOff) };
  } catch {
    return { best: 0, games: 0, muted: false, musicOff: false };
  }
}

export function save(data: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* sin almacenamiento */
  }
}
