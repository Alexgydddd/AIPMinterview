import type { VercelRequest, VercelResponse } from '@vercel/node';
import { devLog, devError } from '../utils/logger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. 立即设置跨域头，防止前端因 CORS 报错
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. 环境变量强制审计
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    devError('CRITICAL ERROR: AI_API_KEY is missing in Vercel Environment Variables.');
    return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
  }

  try {
    // 3. 构造转发请求
    // 保留前端传入的 temperature/top_p（不同场景需要不同随机性），
    // 仅在未传入时使用默认值；max_tokens 始终使用较大值以确保不被截断
    const body = {
      ...req.body,
      max_tokens: req.body.max_tokens || 4096,
    };

    // 仅当前端未指定时设置默认值
    if (body.temperature === undefined) {
      body.temperature = 0.3;
    }
    if (body.top_p === undefined) {
      body.top_p = 0.9;
    }

    devLog('Forwarding request to:', `${baseUrl}/chat/completions`);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // 4. 检查下游 AI 服务器的状态
    if (!response.ok) {
      devError('AI Provider Error:', data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error: any) {
    devError('Proxy Runtime Crash:', error.message, error.stack);
    return res.status(500).json({ 
      error: '服务暂时不可用，请稍后重试', 
      details: error.message 
    });
  }
}
