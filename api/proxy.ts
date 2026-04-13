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
    // 3. 构造转发请求（强制设置低随机性参数）
    const body = {
      ...req.body,
      temperature: 0.1,  // 关键变量：将随机性降到最低
      top_p: 0.1,        // 进一步限制采样范围
      max_tokens: 2000   // 确保分析逻辑不会因长度限制而截断
    };
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
      error: 'Proxy logical crash', 
      details: error.message 
    });
  }
}