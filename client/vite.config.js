import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Honor the PORT env var (tooling like the preview harness assigns a free
    // port this way); fall back to 3000 for normal local dev.
    port: Number(process.env.PORT) || 3000,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
