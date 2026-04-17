import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const LAB_CHUNKS = {
  "linux-terminal-sim":       "lab-linux-terminal",
  "raid-simulator":           "lab-raid",
  "os-install-raid":          "lab-os-install",
  "vsphere-simulator":        "lab-vsphere",
  "sysadmin-sssd-users-gone": "lab-sssd",
  "linux-real-server-sim":    "lab-real-server",
  "sysadmin-6-scenari":       "lab-scenarios",
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [{ urlPattern: /^\/api\//, handler: "NetworkOnly" }],
      },
    }),
  ],

  resolve: {
    // Force a single React instance across all files (root simulators + src/)
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },

  optimizeDeps: {
    // Pre-bundle React so all modules share the exact same singleton
    include: ["react", "react-dom", "react/jsx-runtime"],
  },

  server: {
    proxy: { "/api": "http://localhost:3001" },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep React in the main chunk so every lab chunk imports the same copy
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
          for (const [file, chunk] of Object.entries(LAB_CHUNKS)) {
            if (id.includes(file)) return chunk;
          }
        },
      },
    },
  },
});
