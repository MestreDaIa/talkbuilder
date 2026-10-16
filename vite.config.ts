import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Rolldown's package-subpath resolution can fail for this PDF.js .mjs entry.
      // Resolve directly to the installed file after Docker has installed dependencies.
      "pdfjs-dist/legacy/build/pdf.mjs": path.resolve(
        __dirname,
        "node_modules/pdfjs-dist/legacy/build/pdf.mjs",
      ),
    },
  },
});
