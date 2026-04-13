/**
 * JD 相关工具函数
 * 用于处理 JD 文本的规范化、哈希生成等
 *
 * @deprecated 请使用 services/cacheService 替代
 * - computeJdHash: 使用 SHA-256 的异步哈希函数
 * - getJdCacheKey: 生成带统一前缀的缓存键
 */

import { computeJdHash as _computeJdHash } from '../services/cacheService';

/**
 * @deprecated 请使用 computeJdHash 替代
 * 原函数使用 djb2 算法，碰撞率高，已被 SHA-256 替代
 */
export async function generateJdHash(text: string): Promise<string> {
  console.warn('[jdUtils] generateJdHash 已废弃，请使用 services/cacheService 的 computeJdHash');
  return _computeJdHash(text);
}

/**
 * @deprecated 请使用 getJdCacheKey 替代
 */
export async function getJdCacheKey(text: string): Promise<string> {
  console.warn('[jdUtils] getJdCacheKey 已废弃，请使用 services/cacheService 的 getJdCacheKey');
  const hash = await _computeJdHash(text);
  return `jd_cache_v2_${hash}`;
}
