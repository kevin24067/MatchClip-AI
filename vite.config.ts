import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * P4-03 清理：移除无效的 GEMINI_API_KEY 环境变量注入。
 * 项目使用 Web Audio API 本地分析，不依赖任何外部 API Key。
 */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['__tests__/**/*.test.ts'],
    },
    server: {
        port: 3000,
        host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
});
