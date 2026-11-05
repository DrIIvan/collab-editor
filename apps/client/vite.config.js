import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'


export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host: '127.0.0.1',
        port: 5174,
        allowedHosts: true,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:1234',
                changeOrigin: true,
            },
        },
    },
});