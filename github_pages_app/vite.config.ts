import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("exceljs")) {
            return "exceljs-vendor";
          }
          if (id.includes("jszip")) {
            return "jszip-vendor";
          }
          if (id.includes("pdfjs-dist")) {
            return "pdfjs-vendor";
          }
          return undefined;
        },
      },
    },
  },
});
