import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { omniviewExternals } from "@omniviewdev/vite-plugin";
import { injectCssIntoEntry, localSharedPackages } from "./vite/omniview";

export default defineConfig({
  plugins: [
    localSharedPackages(),
    react(),
    omniviewExternals(),
    injectCssIntoEntry("flux"),
  ],
  server: {
    host: '127.0.0.1',
    port: 15175,
    cors: true,
    strictPort: false,
    hmr: {
      protocol: "ws",
      host: "127.0.0.1",
    },
  },
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      input: "src/entry.ts",
      output: {
        entryFileNames: "assets/entry.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
        format: 'system',
      },
      preserveEntrySignatures: 'exports-only',
    }
  },
});
