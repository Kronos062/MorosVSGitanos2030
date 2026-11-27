import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/pixelify-sans/latin-400.css";
import "@fontsource/pixelify-sans/latin-700.css";
import "./index.css";
import "./styles/pixel-ui.css";
import "./styles/frontier.css";
import App from "./App";
import { spriteAtlas } from "./game/sprites/spriteAtlas";

// Precarga los sprites declarados en assets/sprites/manifest.json. Nunca bloquea ni falla:
// sin manifiesto o con recursos ausentes el juego usa sus primitivas vectoriales originales.
if (import.meta.env.DEV || new URLSearchParams(location.search).has("spritedebug")) {
  (window as unknown as { __sprites: typeof spriteAtlas }).__sprites = spriteAtlas;
}

const mount = () =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

// Se espera a los sprites como máximo 1,5 s: con conexiones lentas el juego arranca igualmente
// (con sus formas originales) y los sprites van apareciendo cuando terminan de cargar.
Promise.race([spriteAtlas.load(), new Promise((r) => setTimeout(r, 1500))]).then(mount, mount);
