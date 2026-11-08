import { defineConfig } from "vite";

// En GitHub Pages el juego vive en /cota-mil-rush/
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
});
