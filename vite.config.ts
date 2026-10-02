import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Porta usada pelo servidor de desenvolvimento (o iniciar.bat define BF_PORT). */
const PORT = Number(process.env.BF_PORT ?? process.env.PORT ?? 5173);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    // 0.0.0.0 permite abrir pelo localhost e também por outros aparelhos na mesma rede
    host: true,
    port: PORT,
    strictPort: false,
    // aceita requisições vindas de qualquer host (túneis, proxy, IP da rede local)
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: PORT + 1,
    strictPort: false,
    allowedHosts: true,
  },
  build: {
    target: "es2020",
    sourcemap: false,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
