import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [
        react(),
        {
            name: 'umami-analytics',
            apply: 'build',
            transformIndexHtml: function () {
                return [{
                        tag: 'script',
                        attrs: {
                            defer: true,
                            src: 'https://analytics.pepperhorn.com/script.js',
                            'data-website-id': '89ac9126-6d3c-4863-aba1-6182d048a12d',
                        },
                        injectTo: 'head',
                    }];
            },
        },
    ],
});
