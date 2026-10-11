import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleApi } from './apiRuntime.js';
export function createApiHandler(path: string) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const code = req.headers['x-beta-access-code'];
    const result = await handleApi(path, req.method || '', req.body, typeof code === 'string' ? code : undefined, process.env);
    res.status(result.status);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', result.contentType || 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (result.status === 405) res.setHeader('Allow', path === '/api/status' ? 'GET' : 'POST');
    res.send(result.body);
  };
}
