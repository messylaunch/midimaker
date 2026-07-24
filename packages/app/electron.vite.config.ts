import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const engineAlias = {
  '@midimaker/engine': resolve(__dirname, '../engine/src/index.ts'),
  '@shared': resolve(__dirname, 'src/shared'),
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: engineAlias },
    build: {
      rollupOptions: {
        // bundle the workspace engine into the main bundle
        external: (id) => id === 'sql.js',
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
    resolve: { alias: engineAlias },
  },
});
