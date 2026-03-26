import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { componentTagger } from "lovable-tagger";

function getNodeModulePackageName(id: string): string | null {
  const normalized = id.split("\\").join("/");
  const marker = "/node_modules/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) return null;

  const subPath = normalized.slice(markerIndex + marker.length);
  const parts = subPath.split("/");
  if (parts.length === 0) return null;

  if (parts[0].startsWith("@") && parts.length > 1) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0] || null;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": "http://localhost:8787",
      "/auth": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
  },
  plugins: [react(), tailwindcss(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          const packageName = getNodeModulePackageName(id);
          if (!packageName) return "vendor";

          if (["react", "react-dom", "react-router", "react-router-dom", "scheduler"].includes(packageName)) {
            return "framework";
          }

          if (
            packageName.startsWith("@radix-ui/") ||
            packageName.startsWith("@react-aria/") ||
            packageName.startsWith("@react-stately/") ||
            packageName.startsWith("@react-types/") ||
            packageName.startsWith("@floating-ui/") ||
            packageName === "react-aria" ||
            packageName === "react-aria-components" ||
            packageName === "vaul"
          ) {
            return "vendor-ui";
          }

          if (
            packageName.startsWith("@tanstack/") ||
            packageName.startsWith("@neondatabase/") ||
            packageName.startsWith("@supabase/") ||
            packageName.startsWith("better-auth") ||
            packageName === "jose" ||
            packageName === "zod"
          ) {
            return "vendor-data";
          }

          if (
            packageName === "recharts" ||
            packageName === "date-fns" ||
            packageName.startsWith("@phosphor-icons/") ||
            packageName === "embla-carousel-react"
          ) {
            return "vendor-visuals";
          }

          return "vendor";
        },
      },
    },
  },
}));
