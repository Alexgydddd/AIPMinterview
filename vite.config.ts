import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApi } from './lib/apiRuntime';
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, '.', ''), NODE_ENV: 'development' };
  return {
    server: { port: 3000, host: '127.0.0.1' },
    plugins: [react(), {
      name: 'shared-dev-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const pathname = req.url?.split('?')[0] ?? '';
          if (!['/api/proxy', '/api/tts', '/api/ocr', '/api/status'].includes(pathname)) return next();
          const chunks: Buffer[] = [];
          let size = 0;
          try {
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 3_000_000) {
                res.statusCode = 413;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: '文件过大，请缩小后重试。' }));
                return;
              }
              chunks.push(Buffer.from(chunk));
            }
            const code = req.headers['x-beta-access-code'];
            const result = await handleApi(pathname, req.method || '', Buffer.concat(chunks).toString('utf8'), typeof code === 'string' ? code : undefined, env);
            res.statusCode = result.status;
            res.setHeader('Content-Type', result.contentType || 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            if (result.status === 405) res.setHeader('Allow', pathname === '/api/status' ? 'GET' : 'POST');
            res.end(result.body);
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: '读取请求失败。' }));
          }
        });
      },
    }],
    build: { rollupOptions: { output: { manualChunks(id) {
      if (!id.includes('node_modules')) return;
      if (id.includes('recharts')) return 'vendor-recharts';
      if (id.includes('docx') || id.includes('file-saver')) return 'vendor-docx';
      if (id.includes('jspdf')) return 'vendor-jspdf';
      if (id.includes('html2canvas')) return 'vendor-html2canvas';
      if (id.includes('lucide-react')) return 'vendor-lucide';
    } } } },
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  };
});
