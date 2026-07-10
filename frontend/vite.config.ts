import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          solana: ["@solana/web3.js", "@solana/web3-compat"],
          phantom: ["@phantom/react-sdk", "@phantom/browser-sdk"],
          anchor: ["@coral-xyz/anchor"],
          motion: ["framer-motion"],
          pump: ["@pump-fun/pump-sdk"],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["@pump-fun/pump-sdk"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
  preview: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
      "/socket.io": { target: "http://localhost:3001", ws: true },
    },
  },
});
