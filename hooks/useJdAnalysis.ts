/**
 * JD 分析自定义 Hook
 * 封装 JD 分析的完整逻辑：缓存检查、API 调用、错误处理、状态管理
 */

import { useCallback, useState } from 'react';
import { JdAnalysis, FileData } from '../types';
import {
  analyzeJobDescription,
} from '../services/geminiService';
import {
  computeJdHash,
  getCachedJdAnalysis,
  setCachedJdAnalysis,
  setLastAnalysisRecord,
  LastAnalysisRecord,
} from '../services/cacheService';
import { devLog, devWarn, devError } from '../utils/logger';

// ============================================================
// 类型定义
// ============================================================

/**
 * JD 分析结果状态
 */
export interface JdAnalysisResult {
  jdAnalysis: JdAnalysis;
  jdText: string;
  hash: string;
  timestamp: number;
}

/**
 * useJdAnalysis Hook 返回类型
 */
export interface UseJdAnalysisReturn {
  // 状态
  isProcessing: boolean;
  error: string | null;

  // 分析方法
  analyze: (company: string, text: string, file?: FileData) => Promise<JdAnalysis | null>;

  // 恢复方法
  restoreFromCache: (hash: string, record: LastAnalysisRecord) => Promise<JdAnalysis | null>;

  // 清除错误
  clearError: () => void;
}

// ============================================================
// Hook 实现
// ============================================================

/**
 * JD 分析 Hook
 * 处理 JD 分析的完整流程，包括：
 * 1. 缓存检查（使用 SHA-256 哈希）
 * 2. API 调用
 * 3. 缓存写入
 * 4. 错误处理
 */
export function useJdAnalysis(): UseJdAnalysisReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 执行 JD 分析
   * @param company 公司名称
   * @param text JD 文本
   * @param file 可选的图片文件
   * @returns 分析结果或 null
   */
  const analyze = useCallback(async (
    company: string,
    text: string,
    file?: FileData
  ): Promise<JdAnalysis | null> => {
    setIsProcessing(true);
    setError(null);

    // 调试日志
    devLog('='.repeat(60));
    devLog('[useJdAnalysis] 开始分析');
    devLog('[useJdAnalysis] 公司名称:', company);
    devLog('[useJdAnalysis] JD 文本长度:', text.length, '字符');
    devLog('[useJdAnalysis] 是否有图片文件:', file ? `是 (${file.mimeType}, ${file.data.length} bytes)` : '否');
    devLog('='.repeat(60));

    try {
      const textTrimmed = text.trim();
      const isEmptyText = !textTrimmed;

      // 计算 SHA-256 哈希
      // 空文本使用带时间戳的占位符生成唯一哈希，避免不同空提交互相命中缓存
      const jdHash = isEmptyText
        ? await computeJdHash(`empty_jd_${Date.now()}_${Math.random().toString(36).slice(2)}`)
        : await computeJdHash(textTrimmed);
      devLog(`[useJdAnalysis] 生成指纹: ${jdHash}`);

      if (isEmptyText) {
        devWarn('[useJdAnalysis] JD 文本为空，将使用占位符');
      }

      // 尝试从缓存读取
      const cachedResult = await getCachedJdAnalysis(jdHash);
      if (cachedResult) {
        devLog(`[useJdAnalysis] 命中缓存，直接使用结果`);

        // 更新分析记录（同步函数，无需 await）
        setLastAnalysisRecord({
          hash: jdHash,
          company,
          position: isEmptyText ? '' : textTrimmed,
          textLength: isEmptyText ? 0 : textTrimmed.length,
          timestamp: Date.now(),
        });

        return cachedResult.data;
      }

      devLog(`[useJdAnalysis] 未命中缓存，调用 AI 分析...`);

      // 调用 AI 分析（空文本时传 null 表示仅有附件）
      const result = await analyzeJobDescription(company, isEmptyText ? null : textTrimmed, file);

      // 写入缓存
      await setCachedJdAnalysis(jdHash, result, company, isEmptyText ? '' : textTrimmed);

      // 更新分析记录（同步函数，无需 await）
      setLastAnalysisRecord({
        hash: jdHash,
        company,
        position: isEmptyText ? '' : textTrimmed,
        textLength: isEmptyText ? 0 : textTrimmed.length,
        timestamp: Date.now(),
      });

      devLog(`[useJdAnalysis] 分析完成，已缓存结果`);
      return result;

    } catch (e) {
      devError('[useJdAnalysis] 分析失败:', e);
      setError('JD 解析失败，请重试。');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * 从缓存恢复分析
   * @param hash 缓存哈希
   * @param record 分析记录
   * @returns 分析结果或 null
   */
  const restoreFromCache = useCallback(async (
    hash: string,
    record: LastAnalysisRecord
  ): Promise<JdAnalysis | null> => {
    try {
      const cached = await getCachedJdAnalysis(hash);

      if (cached) {
        if (cached.data.skills && Array.isArray(cached.data.skills) && cached.data.skills.length > 0) {
          devLog(`[useJdAnalysis] 从缓存恢复成功`);

          // 更新分析记录（同步函数，无需 await）
          setLastAnalysisRecord({
            hash,
            company: record.company,
            position: record.position,
            textLength: record.position.length,
            timestamp: Date.now(),
          });

          return cached.data;
        }
      }

      devLog(`[useJdAnalysis] 缓存已过期或无效`);
      return null;

    } catch (e) {
      devError('[useJdAnalysis] 恢复缓存失败:', e);
      return null;
    }
  }, []);

  /**
   * 清除错误状态
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isProcessing,
    error,
    analyze,
    restoreFromCache,
    clearError,
  };
}
