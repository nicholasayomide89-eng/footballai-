import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Loaded with `--configLoader native` (see package.json scripts): the parent
// repository's package.json isn't valid JSON, which breaks Vite's default
// esbuild-bundled config loading.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: { chunkSizeWarningLimit: 900 },
});
