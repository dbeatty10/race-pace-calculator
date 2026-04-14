/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/race-pace-calculator/",
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "src/engine"),
      "@ui": path.resolve(__dirname, "src/ui"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
});
