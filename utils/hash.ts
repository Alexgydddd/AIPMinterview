/**
 * 生成 JD 文本的唯一指纹哈希
 * 用于 localStorage 缓存 key
 */

export async function generateJdHash(text: string): Promise<string> {
  // 规范化文本：去除首尾空白并转为小写，确保相同内容的不同格式产生相同的哈希
  const normalized = text.trim().toLowerCase();
  
  // 使用 TextEncoder 将字符串转换为 Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  
  // 使用 SHA-256 生成哈希
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // 将 ArrayBuffer 转换为十六进制字符串
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // 返回前 16 个字符作为短哈希（约 64 位熵，足够用于唯一标识）
  return hashHex.slice(0, 16);
}
