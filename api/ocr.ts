import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. 设置跨域头（允许前端访问）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. 读取你在 Vercel 填写的变量
  const apiKey = process.env.SILICONFLOW_API_KEY;
  const baseUrl = process.env.SILICONFLOW_API_BASE || 'https://api.siliconflow.cn/v1';
  // 这里就是读取你刚才在网页填写的模型 ID，如果没读到，默认用 Qwen2.5
  const modelId = process.env.OCR_MODEL_ID || 'Qwen/Qwen2.5-VL-72B-Instruct';

  if (!apiKey) {
    return res.status(500).json({ error: '缺失 SILICONFLOW_API_KEY，请检查 Vercel 变量配置' });
  }

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: '未接收到图片数据' });

    // 处理图片格式（去掉可能存在的 base64 前缀）
    const base64Image = image.includes('base64,') ? image : `data:image/png;base64,${image}`;

    // 3. 发送请求给硅基流动
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "请精准提取图片中的 JD 文字，保持原有的段落和要求。禁止使用 ** 加粗，直接输出纯文本。" },
              { type: "image_url", image_url: { url: base64Image } }
            ]
          }
        ],
        temperature: 0.1
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || '模型接口返回错误');
    }

    // 4. 验证响应结构安全后再提取文字
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('API 响应缺少 choices 字段或为空');
    }

    const message = data.choices[0].message;
    if (!message || typeof message.content !== 'string') {
      throw new Error('API 响应缺少 message.content 字段');
    }

    return res.status(200).json({ text: message.content });

  } catch (error: any) {
    console.error('OCR 运行报错:', error.message);
    return res.status(500).json({ error: 'OCR 识别失败', details: error.message });
  }
}