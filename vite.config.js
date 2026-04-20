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
    minify: "terser",
    terserOptions: {
      compress: { drop_console: true, passes: 2 },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/framer-motion")) return "vendor-motion";
          if (id.includes("node_modules/@stripe") || id.includes("node_modules/stripe")) return "vendor-stripe";
          if (id.includes("node_modules/lucide-react")) return "vendor-icons";
          if (id.includes("node_modules/@prisma") || id.includes("node_modules/prisma")) return "vendor-prisma";
          for (const [file, chunk] of Object.entries(LAB_CHUNKS)) {
            if (id.includes(file)) return chunk;
          }
        },
      },
    },
  },
});
