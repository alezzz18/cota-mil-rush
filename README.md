# 🚗💨 Cota Mil Rush

[![Pruebas y despliegue](https://github.com/alezzz18/cota-mil-rush/actions/workflows/deploy.yml/badge.svg)](https://github.com/alezzz18/cota-mil-rush/actions/workflows/deploy.yml)

Juego de carro en una autopista de Caracas: esquiva **huecos, motorizados, conos y carros**, recoge **monedas** y **estrellas** (te vuelven invencible) y aguanta lo más que puedas mientras la velocidad sube.

🎮 **Jugar:** https://alezzz18.github.io/cota-mil-rush/

| Menú | Partida | Fin de partida |
|---|---|---|
| ![Menú](docs/menu.png) | ![Partida](docs/partida.png) | ![Fin de partida](docs/fin.png) |

## 🕹️ Cómo se juega

| | PC | Celular |
|---|---|---|
| Cambiar de carril | ← → o A / D | Deslizar o tocar a un lado |
| Pausa | P o Esc | Botón ⏸ |
| Empezar / reintentar | Enter o Espacio | Botón |

- 🕳️ Hueco · 🏍️ Motorizado · 🔶 Cono · 🚙 Carro → **choque**
- 🪙 Moneda → suma · ⭐ **Estrella → invencible 7 s**: el carro brilla en colores y rompe todo lo que toca (y da metros extra)
- La velocidad sube poco a poco y las filas de obstáculos se acercan.
- Tu récord se guarda en el navegador y puedes **compartir tu resultado**.

## ✨ Lo técnico

- **TypeScript + Canvas 2D**, sin motores ni librerías de juego. Todo el arte se dibuja con código (sin imágenes) y se adapta a la densidad de cada pantalla.
- **Motor del juego separado** ([`src/game/engine.ts`](src/game/engine.ts)): estado y reglas sin DOM ni dibujo, con aleatoriedad reproducible por semilla.
- **Nunca es imposible:** cada fila deja un carril libre al que se puede llegar desde *cualquier* carril libre de la fila anterior, y los vehículos lentos no bloquean el paso.
- **13 pruebas (Vitest)**, incluida una en la que un conductor automático juega **40 partidas de 2 minutos** sin chocar: si él puede, una persona también.
- **Sonidos sintetizados** con Web Audio (monedas, estrella, choque, récord), vibración en el celular, partículas, sacudida al chocar y pausa automática al cambiar de pestaña.
- Bucle a 60 fps con `requestAnimationFrame` y paso de tiempo limitado.

```
src/
├── game/engine.ts        reglas: movimiento, generación de filas, colisiones, puntaje
├── game/engine.test.ts   pruebas del motor
├── render/sprites.ts     carro, motos, huecos, conos, monedas y estrellas dibujados con Canvas
├── render/renderer.ts    vía, efectos y partículas
├── audio.ts              efectos con Web Audio
├── storage.ts            récord y preferencias
└── main.ts               bucle, controles, pantallas y compartir
```

## 🚀 Ejecutar en local

```bash
git clone https://github.com/alezzz18/cota-mil-rush.git
cd cota-mil-rush
npm install
npm run dev      # http://localhost:5173
npm test         # pruebas del motor
```

Cada *push* a `main` ejecuta tipos, pruebas y build, y publica en GitHub Pages.

## 👤 Autor

**Alejandro Gutiérrez** · Desarrollador Full Stack
[Portafolio](https://alezzz18.github.io) · [GitHub](https://github.com/alezzz18)

## 📄 Licencia

[MIT](LICENSE)
