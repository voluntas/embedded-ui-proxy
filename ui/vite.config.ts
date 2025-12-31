import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  base: process.env.BASE_URL || "/",
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    include: ["uplot"],
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
});
