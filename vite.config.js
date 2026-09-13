import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// The store is served at thomasverigin.ca/3Dprintingstore via a Next.js rewrite
// that strips the prefix, so the deployment itself sees clean paths (/assets, /api).
// Assets must still be *requested* under the prefix, hence base.
export default defineConfig({
  base: "/3Dprintingstore/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
