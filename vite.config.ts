import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: el build funciona en la raíz del dominio y en cualquier subcarpeta.
  base: "./",
  plugins: [react({ jsxImportSource: "mvg-jsx" }), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Envoltorio de JSX que sustituye emojis por iconos pixel art (ver src/ui/jsx).
      "mvg-jsx": path.resolve(__dirname, "src/ui/jsx"),
    },
  },
});
