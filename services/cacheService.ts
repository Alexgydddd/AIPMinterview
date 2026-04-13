/**
 * 统一缓存服务 - cacheService.ts
 *
 * 收口 App.tsx 和 geminiService.ts 中分散的 localStorage 逻辑。
 * 使用统一的缓存前缀 jd_cache_v2_，采用 SHA-256 哈希保证极低碰撞率。
 */

import { JdAnalysis } from '../types';
import { devWarn, devLog } from '../utils/logger';

// ============================================================
// 常量定义
// ============================================================

const CACHE_PREFIX = 'jd_cache_v2_';
const LAST_RECORD_KEY = 'jd_last_analysis_v2';
const CACHE_EXPIRY_DAYS = 7;
const CACHE_EXPIRY_MS = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// ============================================================
// 统一缓存接口
// ============================================================

/**
 * 统一缓存条目接口
 * 包含 data（分析结果）、timestamp（时间戳）、hash（指纹）和 metadata（元信息）
 */
export interface JdCacheEntry {
  data: JdAnalysis;
  timestamp: number;
  hash: string;
  metadata: {
    companyName: string;
    position: string;
    textLength: number;
  };
}

/**
 * 上次分析记录接口
 */
export interface LastAnalysisRecord {
  hash: string;
  company: string;
  position: string;
  textLength: number;
  timestamp: number;
}

// ============================================================
// SHA-256 哈希函数
// ============================================================

/**
 * 使用浏览器原生 crypto.subtle.digest 计算 SHA-256 哈希
 * 异步实现，极低碰撞率
 *
 * @param text - 需要哈希的原始文本
 * @returns Promise<string> - 64 字符的十六进制哈希字符串
 */
export async function computeJdHash(text: string): Promise<string> {
  const normalized = text.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 计算哈希并生成完整的缓存键（带前缀）
 * @param text - 需要哈希的原始文本
 * @returns Promise<string> - 完整的缓存键，如 "jd_cache_v2_<64位哈希>"
 */
export async function getJdCacheKey(text: string): Promise<string> {
  const hash = await computeJdHash(text);
  return `${CACHE_PREFIX}${hash}`;
}

// ============================================================
// 缓存读取
// ============================================================

/**
 * 从 localStorage 获取缓存的 JD 分析结果
 * 自动检查过期时间，过期则删除
 *
 * @param hashOrKey - 哈希指纹或完整缓存键
 * @returns Promise<JdCacheEntry | null> - 缓存条目或 null（无缓存/已过期）
 */
export async function getCachedJdAnalysis(hashOrKey: string): Promise<JdCacheEntry | null> {
  try {
    // 兼容传入完整键或纯哈希
    const cacheKey = hashOrKey.startsWith(CACHE_PREFIX)
      ? hashOrKey
      : `${CACHE_PREFIX}${hashOrKey}`;

    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const entry = JSON.parse(cached) as JdCacheEntry;

    // 检查过期
    const now = Date.now();
    if (now - entry.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    // 验证数据完整性
    if (!entry.data || !entry.data.skills || !Array.isArray(entry.data.skills)) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

// ============================================================
// 缓存写入
// ============================================================

/**
 * 将 JD 分析结果存入 localStorage
 *
 * @param hash - 哈希指纹
 * @param data - 分析结果
 * @param companyName - 公司名称（作为 metadata）
 * @param position - 职位描述摘要（作为 metadata）
 * @returns Promise<boolean> - 是否写入成功
 */
export async function setCachedJdAnalysis(
  hash: string,
  data: JdAnalysis,
  companyName: string,
  position: string
): Promise<boolean> {
  try {
    const cacheKey = `${CACHE_PREFIX}${hash}`;
    const entry: JdCacheEntry = {
      data,
      timestamp: Date.now(),
      hash,
      metadata: {
        companyName,
        position: position.slice(0, 200), // 限制存储长度
        textLength: position.length,
      },
    };

    localStorage.setItem(cacheKey, JSON.stringify(entry));
    return true;
  } catch (e) {
    devWarn('[CacheService] 缓存写入失败（可能 storage 已满）:', e);
    return false;
  }
}

// ============================================================
// 上次分析记录
// ============================================================

/**
 * 获取上一次分析记录
 *
 * @returns LastAnalysisRecord | null
 */
export function getLastAnalysisRecord(): LastAnalysisRecord | null {
  try {
    const raw = localStorage.getItem(LAST_RECORD_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as LastAnalysisRecord;

    // 检查记录是否过期（超过缓存有效期）
    const now = Date.now();
    if (now - record.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(LAST_RECORD_KEY);
      return null;
    }

    return record;
  } catch {
    return null;
  }
}

/**
 * 设置上一次分析记录
 *
 * @param record - 分析记录
 * @returns boolean - 是否写入成功
 */
export function setLastAnalysisRecord(record: LastAnalysisRecord): boolean {
  try {
    localStorage.setItem(LAST_RECORD_KEY, JSON.stringify(record));
    return true;
  } catch (e) {
    devWarn('[CacheService] LastAnalysisRecord 写入失败:', e);
    return false;
  }
}

// ============================================================
// 便捷方法：同时设置缓存和记录
// ============================================================

/**
 * 快速保存分析结果和记录
 * 适用于分析完成后同时写入缓存和记录
 *
 * @param hash - 哈希指纹
 * @param data - 分析结果
 * @param companyName - 公司名称
 * @param position - 职位描述摘要
 */
export async function saveAnalysisWithRecord(
  hash: string,
  data: JdAnalysis,
  companyName: string,
  position: string
): Promise<void> {
  await setCachedJdAnalysis(hash, data, companyName, position);
  setLastAnalysisRecord({
    hash,
    company: companyName,
    position,
    textLength: position.length,
    timestamp: Date.now(),
  });
}

// ============================================================
// 缓存管理
// ============================================================

/**
 * 清除所有 JD 缓存（不包含 lastAnalysisRecord）
 * 用于「重新分析」场景
 */
export function clearJdCaches(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
  devLog(`[CacheService] 已清除 ${keysToRemove.length} 条 JD 缓存`);
}

/**
 * 清除所有缓存（包括 lastAnalysisRecord）
 */
export function clearAllCaches(): void {
  localStorage.clear();
  devLog('[CacheService] 已清除所有本地缓存');
}

/**
 * 获取当前缓存统计信息
 */
export function getCacheStats(): { count: number; oldestTimestamp: number | null } {
  let count = 0;
  let oldestTimestamp: number | null = null;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      count++;
      try {
        const entry = JSON.parse(localStorage.getItem(key)!) as JdCacheEntry;
        if (!oldestTimestamp || entry.timestamp < oldestTimestamp) {
          oldestTimestamp = entry.timestamp;
        }
      } catch {
        // 忽略解析失败
      }
    }
  }

  return { count, oldestTimestamp };
}

// ============================================================
// 向后兼容：保留旧接口别名
// ============================================================

/**
 * @deprecated 请使用 computeJdHash 代替
 */
export const generateJdHash = computeJdHash;

/**
 * @deprecated 请使用 getJdCacheKey 代替
 */
export const getJdCacheKeyLegacy = (text: string) =>
  `jd_cache_${(text.trim().toLowerCase().split('').reduce((a, c) => ((a << 5) + a) ^ c.charCodeAt(0), 5381) >>> 0).toString(36)}`;