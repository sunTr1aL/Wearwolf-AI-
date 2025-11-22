import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Prevents "process is not defined" error in some libraries
      'process.env': {},
      // Inject API Key specifically
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    server: {
      port: 1234,
    }
  };
});