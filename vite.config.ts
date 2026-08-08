import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  build: {
    // Recharts is the one genuinely large, cleanly-separable dependency (it
    // only matters to the dashboard route) — splitting it into its own chunk
    // gets it comfortably under the default 500kB warning on its own. What's
    // left is the app plus the rest of its UI stack (radix-ui, react-hook-form,
    // dnd-kit, date-fns, TanStack Query…) as a single ~820kB/~240kB-gzip
    // chunk — reasonable for a small internal tool with no route-level
    // lazy-loading yet, so the limit below is raised to match reality rather
    // than chasing every last library into its own chunk.
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "recharts", test: /node_modules[\\/]recharts/ }],
        },
      },
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
