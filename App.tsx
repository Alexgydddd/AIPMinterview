import React, { useState, lazy, Suspense } from 'react';
import { useSessionState, clearSessionDraft } from './hooks/useSessionState';
import { downloadText } from './utils/download';
import type { InterviewMessage } from './utils/interview';
import StepIndicator from './components/StepIndicator';
import HomeView from './components/HomeView';
import { AppStep, JdAnalysis, ResumeOptimization, FileData, InterviewFeedback } from './types';
import { optimizeResume, generateInterviewFeedback } from './services/geminiService';
import {
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
// 主应用组件
// ============================================================

const App: React.FC = () => {
  // 流程状态
  const [currentStep, setCurrentStep] = useSessionState<AppStep>('step', AppStep.HOME);
  const [isFastTrack, setIsFastTrack] = useSessionState('fastTrack', false);

  // 数据状态
  const [companyName, setCompanyName] = useSessionState<string>('company', '');
  const [jdText, setJdText] = useSessionState<string>('jd', '');
  const [resumeText, setResumeText] = useSessionState<string>('resume', '');
  const [refinedResumeText, setRefinedResumeText] = useSessionState<string>('refined', '');

  const [jdAnalysis, setJdAnalysis] = useSessionState<JdAnalysis | null>('jdResult', null);
  const [resumeOpt, setResumeOpt] = useSessionState<ResumeOptimization | null>('resumeResult', null);
  const [interviewHistory, setInterviewHistory] = useSessionState<InterviewFeedback | null>('feedback', null);

  const [interviewDraft, setInterviewDraft] = useSessionState<InterviewMessage[]>('interview', []);
  const [lastTranscript, setLastTranscript] = useSessionState<string>('transcript', '');
  const [previousFeedback, setPreviousFeedback] = useSessionState<InterviewFeedback | null>('previousFeedback', null);
  const [savedStep, setSavedStep] = useSessionState<AppStep>('savedStep', AppStep.HOME);

  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false);

  // UI 状态
  const [error, setError] = useState<string | null>(null);

  // 分析 Hook
  const { analyze: analyzeJd, restoreFromCache, error: jdError, isProcessing: isJdProcessing, clearError } = useJdAnalysis();

  // ============================================================
  // 导航处理
  // ============================================================

  const handleBackToHome = async () => {
    setSavedStep(currentStep);
    setError(null);
    setCurrentStep(AppStep.HOME);
  };

  const navigateTo = async (step: AppStep) => {
    if (isProcessing || isJdProcessing) return;
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
    setError(null); clearError();

  };

  // ============================================================
  // JD 分析处理
  // ============================================================

  const handleJdAnalysis = async (company: string, text: string, file?: FileData) => {
    const result = await analyzeJd(company, text, file);

    if (result) {
      setResumeOpt(null); setResumeText(""); setRefinedResumeText("");
      setInterviewHistory(null); setPreviousFeedback(null); setInterviewDraft([]); setLastTranscript("");
      try { sessionStorage.removeItem("aipm_draft_rewritten"); } catch {}
      setCompanyName(company);
      setJdText(text.trim() || "（详见上传的JD附件）");
      setJdAnalysis(result);

      setCurrentStep(AppStep.JD_ANALYSIS);
    }
  };

  // ============================================================
  // 缓存恢复处理
  // ============================================================

  const handleRestoreFromCache = async (hash: string, record: LastAnalysisRecord) => {
    const result = await restoreFromCache(hash, record);

    if (result) {
      setResumeOpt(null); setResumeText(""); setRefinedResumeText("");
      setInterviewHistory(null); setPreviousFeedback(null); setInterviewDraft([]); setLastTranscript("");
      try { sessionStorage.removeItem("aipm_draft_rewritten"); } catch {}
      setCompanyName(record.company);
      setJdText(record.position || "（详见缓存）");
      setJdAnalysis(result);
      setCurrentStep(AppStep.JD_ANALYSIS);
    } else {
      setCompanyName(record.company);
      setJdText(record.position || "");
      setJdAnalysis(null);
      setError("缓存已过期，请重新分析岗位。");
      setCurrentStep(AppStep.JD_INPUT);
    }
  };

  // ============================================================
  // 简历分析处理
  // ============================================================

  const handleResumeAnalysis = async (text: string, file?: FileData) => {
    setIsProcessing(true);
    setError(null);
    try {
      const contentText = text.trim();
      if (!contentText) throw new Error("请先输入或提取简历文字。");

      const context = `
      Target Company: ${companyName}
      Level: ${jdAnalysis?.level}
      Persona: ${jdAnalysis?.persona}
      JD Text: ${jdText}
      `;

      const result = await optimizeResume(context, contentText, file);
      setResumeText(contentText);
      setResumeOpt(result);
      setRefinedResumeText(""); setInterviewDraft([]);
      try { sessionStorage.removeItem("aipm_draft_rewritten"); } catch {}
      setCurrentStep(AppStep.RESUME_OPTIMIZATION);
    } catch (e) {
      devError(e);
      setError(e instanceof Error ? e.message : "简历优化失败，请重试。");
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================
  // Fast Track 处理
  // ============================================================

  const handleFastTrackStart = (company: string, jd: string, resume: string) => {
    setInterviewDraft([]); setInterviewHistory(null); setPreviousFeedback(null);
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
    setLastTranscript(transcript); setError(null); setInterviewHistory(null);
    setIsProcessing(true);
    setCurrentStep(AppStep.INTERVIEW_FEEDBACK);

    try {
      let summaryContext = `目标公司：${companyName}。
目标岗位 JD：${jdText}`;

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

      const feedback = await generateInterviewFeedback(summaryContext, previousFeedback);
      setInterviewHistory(feedback);

    } catch (e) {
      devError(e);
      setError(e instanceof Error ? e.message : '面试报告生成失败，请重试。');

    } finally {
      setIsProcessing(false);
      setCurrentStep(AppStep.INTERVIEW_FEEDBACK);
    }
  };

  const restartWithMemory = () => {
    setPreviousFeedback(interviewHistory); setInterviewDraft([]); setError(null);
    setCurrentStep(AppStep.MOCK_INTERVIEW);
  };

  // ============================================================
  // 缓存管理
  // ============================================================

  const handleClearCache = () => {
    clearAllCaches();
  };

  // ============================================================
  // 渲染
  // ============================================================

  const resumeForInterview = isFastTrack ? resumeText : refinedResumeText || resumeText;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col selection:bg-violet-200">
      <StepIndicator disabled={isProcessing || isJdProcessing} currentStep={currentStep} onNavigate={navigateTo} isFastTrack={isFastTrack} />

      <main className="container mx-auto pt-6 flex-1 pb-16">
        {(error || jdError) && (
          <div className="max-w-xl mx-auto mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-center justify-between shadow-sm">
            <span className="text-sm font-medium">{error || jdError}</span>
            <button onClick={() => { setError(null); clearError(); }} className="text-xs font-bold hover:underline">关闭</button>
          </div>
        )}

        {/* Phase 0: Home */}
        {currentStep === AppStep.HOME && (
          <HomeView onSelectScenario={navigateTo} onResume={savedStep !== AppStep.HOME ? () => setCurrentStep(savedStep) : undefined} />
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
              <JdAnalysisView
                jdAnalysis={jdAnalysis}
                onAnalyze={handleJdAnalysis}
                onEdit={() => { setJdAnalysis(null); setCurrentStep(AppStep.JD_INPUT); }}
                isLoading={isProcessing || isJdProcessing}
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
              previousFeedback={previousFeedback}
              draft={interviewDraft}
              onDraftChange={setInterviewDraft}
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
              {interviewHistory ? <UpsellView feedback={interviewHistory} transcript={lastTranscript} onRestart={restartWithMemory} /> : (
                <div className="max-w-xl mx-auto p-8 text-center bg-white rounded-2xl border border-slate-200">
                  <h2 className="text-xl font-bold mb-3">报告暂未生成</h2>
                  <p className="text-sm text-slate-500 mb-6">{error || '可以继续生成报告，已保存本次对话。'}</p>
                  <button onClick={() => void finishInterview(lastTranscript)} disabled={!lastTranscript} className="bg-violet-600 text-white rounded-xl px-6 py-3 font-bold disabled:opacity-40">重新生成本次报告</button>
                  <button onClick={() => downloadText('模拟面试对话.txt', lastTranscript)} className="block mx-auto mt-4 text-sm text-violet-600">下载本次对话</button>
                </div>
              )}
            </StepSuspense>
          )
        )}
      </main>

      {/* Global Footer */}
      <footer className="py-6 text-center text-slate-400 text-xs border-t border-slate-100 bg-white/50 backdrop-blur-sm">
        <button onClick={() => {
          clearAllCaches(); clearSessionDraft(); window.location.reload();
        }} className="mb-3 text-slate-500 underline">清除本机练习资料并重新开始</button>
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
