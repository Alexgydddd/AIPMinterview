import React, { useState, useRef, lazy, Suspense, useEffect } from 'react';
import StepIndicator from './components/StepIndicator';
import HomeView from './components/HomeView';
import { AppStep, JdAnalysis, ResumeOptimization, FileData, InterviewFeedback } from './types';
import { optimizeResume, generateInterviewFeedback } from './services/geminiService';
import {
  getLastAnalysisRecord as getCacheLastRecord,
  clearAllCaches,
  LastAnalysisRecord,
} from './services/cacheService';
import { useJdAnalysis } from './hooks/useJdAnalysis';
import { devError } from './utils/logger';

// ============================================================
// 懒加载组件
// ============================================================

const JdAnalysisView = lazy(() => import('./components/JdAnalysisView'));
const ResumeOptimizerView = lazy(() => import('./components/ResumeOptimizerView'));
const ResumeRewriteView = lazy(() => import('./components/ResumeRewriteView'));
const InterviewLiveView = lazy(() => import('./components/InterviewLiveView'));
const FastTrackSetupView = lazy(() => import('./components/FastTrackSetupView'));
const UpsellView = lazy(() => import('./components/UpsellView'));

// ============================================================
// Loading Suspense 组件
// ============================================================

const StepSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense
    fallback={
      <div className="flex flex-col items-center justify-center min-h-[42vh] gap-4">
        <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-400 font-medium tracking-wide">加载页面资源…</p>
      </div>
    }
  >
    {children}
  </Suspense>
);

// ============================================================
// 上次分析提示组件
// ============================================================

interface LastAnalysisPromptProps {
  lastAnalysis: React.MutableRefObject<LastAnalysisRecord | null>;
  onRestore: (hash: string, record: LastAnalysisRecord) => void;
  onReanalyze: () => void;
}

const LastAnalysisPrompt: React.FC<LastAnalysisPromptProps> = React.memo(({
  lastAnalysis,
  onRestore,
  onReanalyze,
}) => {
  if (
    !lastAnalysis.current ||
    !lastAnalysis.current.company ||
    !lastAnalysis.current.hash ||
    !lastAnalysis.current.position
  ) {
    return null;
  }

  const position = lastAnalysis.current.position;
  return (
    <div
      className="max-w-xl mx-auto mb-6 px-5 py-3 bg-yellow-50 border border-yellow-200 rounded-2xl text-yellow-800 shadow-sm flex items-center justify-between gap-3"
      style={{ animation: 'fadeIn 450ms' }}
    >
      <div>
        <span className="font-medium text-sm">
          检测到您上次分析过 <b>{lastAnalysis.current.company}</b> 的岗位：
        </span>
        <span className="text-xs text-yellow-700 ml-2">
          {position.length > 36 ? position.slice(0, 32) + '...' : position}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          className="text-xs px-2 py-1 bg-yellow-100 border border-yellow-300 rounded hover:bg-yellow-200 transition"
          onClick={() => onRestore(lastAnalysis.current!.hash, lastAnalysis.current!)}
        >
          直接查看
        </button>
        <button
          className="text-xs px-2 py-1 bg-white border border-yellow-300 rounded hover:bg-yellow-100 transition"
          onClick={onReanalyze}
        >
          重新分析
        </button>
      </div>
    </div>
  );
});

LastAnalysisPrompt.displayName = 'LastAnalysisPrompt';

// ============================================================
// 主应用组件
// ============================================================

const App: React.FC = () => {
  // 流程状态
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.HOME);
  const [isFastTrack, setIsFastTrack] = useState(false);

  // 视图重载 Key
  const [jdInputViewKey, setJdInputViewKey] = useState(0);

  // 数据状态
  const [companyName, setCompanyName] = useState<string>('');
  const [jdText, setJdText] = useState<string>('');
  const [resumeText, setResumeText] = useState<string>('');
  const [refinedResumeText, setRefinedResumeText] = useState<string>('');

  const [jdAnalysis, setJdAnalysis] = useState<JdAnalysis | null>(null);
  const [resumeOpt, setResumeOpt] = useState<ResumeOptimization | null>(null);
  const [interviewHistory, setInterviewHistory] = useState<InterviewFeedback | null>(null);

  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false);

  // UI 状态
  const [error, setError] = useState<string | null>(null);
  const [showLastPrompt, setShowLastPrompt] = useState(true);
  const [hideLastPromptKey, setHideLastPromptKey] = useState(0);

  // 分析 Hook
  const { analyze: analyzeJd, restoreFromCache, clearError } = useJdAnalysis();

  // 上次分析数据 Ref
  const lastAnalysis = useRef<LastAnalysisRecord | null>(null);

  // 初始化：加载上次分析记录
  useEffect(() => {
    const initLastAnalysis = async () => {
      lastAnalysis.current = await getCacheLastRecord();
    };
    initLastAnalysis();
  }, []);

  // ============================================================
  // 导航处理
  // ============================================================

  const handleBackToHome = async () => {
    setCompanyName('');
    setJdText('');
    setResumeText('');
    setRefinedResumeText('');
    setJdAnalysis(null);
    setResumeOpt(null);
    setInterviewHistory(null);
    setIsFastTrack(false);
    setError(null);
    setJdInputViewKey(k => k + 1);

    setShowLastPrompt(true);
    lastAnalysis.current = await getCacheLastRecord();
    setHideLastPromptKey(k => k + 1);
    setCurrentStep(AppStep.HOME);
  };

  const navigateTo = async (step: AppStep) => {
    if (step === AppStep.HOME) {
      handleBackToHome();
      return;
    }

    if (step === AppStep.FAST_TRACK_SETUP) {
      setIsFastTrack(true);
    } else if (step === AppStep.JD_INPUT) {
      setIsFastTrack(false);
    }

    setCurrentStep(step);
    setError(null);

    if (step === AppStep.JD_INPUT) {
      setShowLastPrompt(true);
      lastAnalysis.current = await getCacheLastRecord();
      setHideLastPromptKey(k => k + 1);
    }
  };

  // ============================================================
  // JD 分析处理
  // ============================================================

  const handleJdAnalysis = async (company: string, text: string, file?: FileData) => {
    const result = await analyzeJd(company, text, file);

    if (result) {
      setCompanyName(company);
      setJdText(text.trim() || "（详见上传的JD附件）");
      setJdAnalysis(result);

      lastAnalysis.current = {
        hash: '',
        company,
        position: text.trim() || "（详见上传的JD附件）",
        textLength: text.length,
        timestamp: Date.now(),
      };

      setCurrentStep(AppStep.JD_ANALYSIS);
    }
  };

  // ============================================================
  // 缓存恢复处理
  // ============================================================

  const handleRestoreFromCache = async (hash: string, record: LastAnalysisRecord) => {
    const result = await restoreFromCache(hash, record);

    if (result) {
      setCompanyName(record.company);
      setJdText(record.position || "（详见缓存）");
      setJdAnalysis(result);
      lastAnalysis.current = { ...record };
      setCurrentStep(AppStep.JD_ANALYSIS);
    } else {
      setCompanyName(record.company);
      setJdText(record.position || "");
      setCurrentStep(AppStep.JD_ANALYSIS);
    }
  };

  // ============================================================
  // 简历分析处理
  // ============================================================

  const handleResumeAnalysis = async (text: string, file?: FileData) => {
    setIsProcessing(true);
    setError(null);
    try {
      const contentText = text || "（详见上传的简历附件）";

      const context = `
      Target Company: ${companyName}
      Level: ${jdAnalysis?.level}
      Persona: ${jdAnalysis?.persona}
      JD Text: ${jdText}
      `;

      const result = await optimizeResume(context, contentText, file);
      setResumeText(contentText);
      setResumeOpt(result);
      setCurrentStep(AppStep.RESUME_OPTIMIZATION);
    } catch (e) {
      devError(e);
      setError("简历优化失败，请重试。");
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================
  // Fast Track 处理
  // ============================================================

  const handleFastTrackStart = (company: string, jd: string, resume: string) => {
    setCompanyName(company);
    setJdText(jd);
    setResumeText(resume);
    setRefinedResumeText(resume);
    setCurrentStep(AppStep.MOCK_INTERVIEW);
  };

  // ============================================================
  // 简历改写完成
  // ============================================================

  const handleRewriteComplete = (refinedText: string) => {
    setRefinedResumeText(refinedText);
    setCurrentStep(AppStep.MOCK_INTERVIEW);
  };

  // ============================================================
  // 面试完成处理
  // ============================================================

  const finishInterview = async (transcript: string) => {
    setIsProcessing(true);
    setCurrentStep(AppStep.INTERVIEW_FEEDBACK);

    try {
      let summaryContext = `Candidate applied for ${companyName}.`;

      if (isFastTrack) {
        summaryContext += `Mode: Fast Track (Raw Resume).`;
      } else {
        const critiques = (resumeOpt?.improvements ?? []).map((s) => s.critique).join('; ');
        summaryContext += `Mode: Full Prep (Optimized Resume). 
           Identified Weaknesses in original resume: ${critiques || '（无）'}.`;
      }

      summaryContext += `
        Actual Interview Transcript:
        ${transcript}
        `;

      const feedback = await generateInterviewFeedback(summaryContext, interviewHistory);
      setInterviewHistory(feedback);

    } catch (e) {
      devError(e);
      setError('面试报告生成失败，请检查网络后重试。');
      setInterviewHistory({
        score: 0,
        strengths: [],
        weaknesses: [],
        improvementPlan:
          '本次未能生成评估报告。请检查网络与 API 配置后，点击「再练一次」重试。',
      });
    } finally {
      setIsProcessing(false);
      setCurrentStep(AppStep.UPSELL);
    }
  };

  const restartWithMemory = () => {
    setCurrentStep(AppStep.MOCK_INTERVIEW);
  };

  // ============================================================
  // 缓存管理
  // ============================================================

  const handleClearCache = () => {
    clearAllCaches();
    lastAnalysis.current = null;
    setShowLastPrompt(false);
    setHideLastPromptKey(k => k + 1);
  };

  // ============================================================
  // 重新分析处理
  // ============================================================

  const handleReanalyzeFromPrompt = () => {
    setCompanyName('');
    setJdText('');
    setJdAnalysis(null);
    setResumeOpt(null);
    setResumeText('');
    setRefinedResumeText('');
    setInterviewHistory(null);
    setError(null);
    setShowLastPrompt(false);
    setHideLastPromptKey(k => k + 1);
  };

  // ============================================================
  // 渲染
  // ============================================================

  const resumeForInterview = isFastTrack ? resumeText : refinedResumeText || resumeText;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col selection:bg-violet-200">
      <StepIndicator currentStep={currentStep} onNavigate={navigateTo} isFastTrack={isFastTrack} />

      <main className="container mx-auto pt-6 flex-1 pb-16">
        {error && (
          <div className="max-w-xl mx-auto mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-center justify-between shadow-sm">
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="text-xs font-bold hover:underline">关闭</button>
          </div>
        )}

        {/* Phase 0: Home */}
        {currentStep === AppStep.HOME && (
          <HomeView onSelectScenario={navigateTo} />
        )}

        {/* Fast Track Flow */}
        {currentStep === AppStep.FAST_TRACK_SETUP && (
          <StepSuspense>
            <FastTrackSetupView
              onStart={handleFastTrackStart}
              onBack={() => navigateTo(AppStep.HOME)}
            />
          </StepSuspense>
        )}

        {/* Full Prep Flow - JD Input & Analysis */}
        {(currentStep === AppStep.JD_INPUT || currentStep === AppStep.JD_ANALYSIS) && (
          <StepSuspense>
            <>
              {currentStep === AppStep.JD_INPUT && (
                <span key={hideLastPromptKey}>
                  <LastAnalysisPrompt
                    lastAnalysis={lastAnalysis}
                    onRestore={handleRestoreFromCache}
                    onReanalyze={handleReanalyzeFromPrompt}
                  />
                </span>
              )}
              <JdAnalysisView
                key={`jd-input-${jdInputViewKey}`}
                jdAnalysis={jdAnalysis}
                onAnalyze={handleJdAnalysis}
                isLoading={isProcessing}
                onNext={() => setCurrentStep(AppStep.RESUME_INPUT)}
                onClearCache={handleClearCache}
                onRestoreFromCache={handleRestoreFromCache}
              />
            </>
          </StepSuspense>
        )}

        {/* Resume Optimization */}
        {(currentStep === AppStep.RESUME_INPUT || currentStep === AppStep.RESUME_OPTIMIZATION) && (
          <StepSuspense>
            <ResumeOptimizerView
              optimization={resumeOpt}
              onAnalyze={handleResumeAnalysis}
              isLoading={isProcessing}
              onNext={() => setCurrentStep(AppStep.RESUME_REWRITE)}
              jdContext={jdText}
              originalResumeText={resumeText}
            />
          </StepSuspense>
        )}

        {/* Resume Rewrite */}
        {currentStep === AppStep.RESUME_REWRITE && resumeOpt && (
          <StepSuspense>
            <ResumeRewriteView
              jdContext={jdText}
              originalResumeText={resumeText}
              improvements={resumeOpt.improvements}
              onNext={handleRewriteComplete}
            />
          </StepSuspense>
        )}

        {/* Mock Interview */}
        {currentStep === AppStep.MOCK_INTERVIEW && (
          <StepSuspense>
            <InterviewLiveView
              companyName={companyName}
              jdText={jdText}
              resumeText={resumeForInterview}
              previousFeedback={interviewHistory}
              onFinish={finishInterview}
              onBack={() => {
                if (isFastTrack) setCurrentStep(AppStep.FAST_TRACK_SETUP);
                else setCurrentStep(AppStep.RESUME_REWRITE);
              }}
            />
          </StepSuspense>
        )}

        {/* Interview Feedback & Upsell */}
        {(currentStep === AppStep.UPSELL || currentStep === AppStep.INTERVIEW_FEEDBACK) && (
          isProcessing ? (
            <div className="flex flex-col items-center justify-center h-[60vh]">
              <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mb-6"></div>
              <p className="text-slate-400 font-medium tracking-wide">正在生成面试评估报告...</p>
            </div>
          ) : (
            <StepSuspense>
              <UpsellView feedback={interviewHistory} onRestart={restartWithMemory} />
            </StepSuspense>
          )
        )}
      </main>

      {/* Global Footer */}
      <footer className="py-6 text-center text-slate-400 text-xs border-t border-slate-100 bg-white/50 backdrop-blur-sm">
        <p>
          如果有更多的体验建议，欢迎邮件给我{' '}
          <a href="mailto:alexgyd@163.com" className="text-indigo-500 hover:underline">
            alexgyd@163.com
          </a>
        </p>
      </footer>
    </div>
  );
};

export default App;
