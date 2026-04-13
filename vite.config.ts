import path from 'path';
import type { IncomingMessage } from 'http';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import {
  proxyChatCompletion,
  sanitizeChatCompletionBody,
  resolveProxySecretsForViteDev,
} from './lib/proxyChatCompletion';
import {
  fetchMinimaxTtsMp3,
  parseTtsClientBody,
  resolveMinimaxSecrets,
} from './lib/minimaxTtsForward';

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return;
              if (id.includes('@google/genai')) return 'vendor-genai';
              if (id.includes('recharts')) return 'vendor-recharts';
              if (id.includes('docx') || id.includes('file-saver')) return 'vendor-docx';
              if (id.includes('jspdf')) return 'vendor-jspdf';
              if (id.includes('html2canvas')) return 'vendor-html2canvas';
              if (id.includes('lucide-react')) return 'vendor-lucide';
            },
          },
        },
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'dev-openai-proxy',
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
              const pathname = req.url?.split('?')[0] ?? '';
              if (req.method !== 'POST') {
                next();
                return;
              }

              if (pathname === '/api/tts') {
                try {
                  const rawBody = await readRequestBody(req as IncomingMessage);
                  let parsed: unknown;
                  try {
                    parsed = JSON.parse(rawBody);
                  } catch {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                    return;
                  }
                  let text: string;
                  let overrides: ReturnType<typeof parseTtsClientBody>['overrides'];
                  try {
                    const p = parseTtsClientBody(parsed);
                    text = p.text;
                    overrides = p.overrides;
                  } catch (e) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(
                      JSON.stringify({
                        error: e instanceof Error ? e.message : 'Bad request',
                      })
                    );
                    return;
                  }
                  const mm = resolveMinimaxSecrets(env);
                  if (!mm) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(
                      JSON.stringify({
                        error: 'Missing MINIMAX_API_KEY — 写入 .env（本地开发）',
                      })
                    );
                    return;
                  }
                  const mp3 = await fetchMinimaxTtsMp3(mm, text, overrides);
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'audio/mpeg');
                  res.setHeader('Cache-Control', 'private, max-age=3600');
                  res.end(Buffer.from(mp3));
                } catch (e) {
                  console.error('[dev-minimax-tts]', e);
                  res.statusCode = 502;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(
                    JSON.stringify({
                      error: e instanceof Error ? e.message : 'MiniMax TTS failed',
                    })
                  );
                }
                return;
              }

              if (pathname !== '/api/proxy') {
                next();
                return;
              }
              try {
                const raw = await readRequestBody(req as IncomingMessage);
                let parsed: unknown;
                try {
                  parsed = JSON.parse(raw);
                } catch {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                  return;
                }
                const safe = sanitizeChatCompletionBody(parsed);
                if (!safe) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(
                    JSON.stringify({
                      error:
                        'Invalid body: require model (string) and messages (array of {role, content})',
                    })
                  );
                  return;
                }
                const secrets = resolveProxySecretsForViteDev(env);
                if (!secrets) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(
                    JSON.stringify({
                      error:
                        'Missing AI_API_KEY / OPENAI_API_KEY (或本地可暂用 VITE_AI_API_KEY) — 写入 .env',
                    })
                  );
                  return;
                }
                const { status, text } = await proxyChatCompletion(safe, secrets);
                res.statusCode = status;
                res.setHeader(
                  'Content-Type',
                  text.trim().startsWith('{')
                    ? 'application/json; charset=utf-8'
                    : 'text/plain; charset=utf-8'
                );
                res.end(text);
              } catch (e) {
                console.error('[dev-openai-proxy]', e);
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ error: 'Proxy failed' }));
              }
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
