import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { generateInterviewReply } from '../services/geminiService';
import { synthesizeSpeech } from '../services/minimaxService';
import { Mic, PhoneOff, Building2, Play, ChevronLeft, MessageSquareText, Eye, EyeOff, Clock, MessageCircle } from 'lucide-react';
import { InterviewFeedback } from '../types';
import { devLog, devError } from '../utils/logger';

interface Props {
  companyName: string;
  jdText: string;
  resumeText: string;
  previousFeedback?: InterviewFeedback | null;
  onFinish: (transcript: string) => void;
  onBack: () => void;
}

const BARS = 5;

const MIN_ROUNDS = 3;
const SUGGESTED_ROUNDS = 6;
const MAX_ROUNDS = 12;

const AudioVisualizer = memo(({ isActive, color = 'bg-white' }: { isActive: boolean, color?: string }) => {
  return (
    <div className="flex items-center justify-center gap-1.5 h-12">
      {[...Array(BARS)].map((_, i) => (
        <div
          key={i}
          className={`w-2 rounded-full ${color} ${isActive ? `audio-bar-${i + 1}` : ''}`}
          style={{
            height: isActive ? undefined : '4px',
            opacity: isActive ? 1 : 0.3,
            animation: isActive ? `audioWave${i + 1} 0.6s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  );
});

AudioVisualizer.displayName = 'AudioVisualizer';

const CANDIDATE_PREFIX = '候选人: ';
const INTERVIEWER_PREFIX = '面试官: ';

function parseTranscriptLine(line: string): { role: 'user' | 'assistant'; content: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(CANDIDATE_PREFIX)) {
    const content = trimmed.slice(CANDIDATE_PREFIX.length).trim();
    return content ? { role: 'user', content } : null;
  }
  if (trimmed.startsWith(INTERVIEWER_PREFIX)) {
    const content = trimmed.slice(INTERVIEWER_PREFIX.length).trim();
    return content ? { role: 'assistant', content } : null;
  }
  return null;
}

function buildMessagesFromTranscript(transcript: string): { role: 'user' | 'assistant'; content: string }[] {
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const line of transcript.split('\n')) {
    const parsed = parseTranscriptLine(line);
    if (parsed) messages.push(parsed);
  }
  return messages;
}

function countRounds(transcript: string): number {
  let count = 0;
  for (const line of transcript.split('\n')) {
    if (line.trim().startsWith(CANDIDATE_PREFIX)) count++;
  }
  return count;
}

async function cleanupAudioResources(
  audioSourceRef: React.MutableRefObject<AudioBufferSourceNode | null>,
  audioContextRef: React.MutableRefObject<AudioContext | null>
): Promise<void> {
  if (audioSourceRef.current) {
    try { audioSourceRef.current.disconnect(); } catch {}
    audioSourceRef.current = null;
  }
  if (audioContextRef.current) {
    try {
      if (audioContextRef.current.state !== 'closed') await audioContextRef.current.close();
    } catch {}
    audioContextRef.current = null;
  }
}

/** 格式化秒为 mm:ss */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const InterviewLiveView: React.FC<Props> = ({
  companyName, jdText, resumeText, previousFeedback, onFinish, onBack,
}) => {
  const [isStarted, setIsStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [showTranscript, setShowTranscript] = useState(true);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [roundCount, setRoundCount] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const transcriptRef = useRef<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 计时器
  useEffect(() => {
    if (isStarted && isConnected) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted, isConnected]);

  // 统计轮次
  useEffect(() => {
    setRoundCount(countRounds(transcriptRef.current));
  }, [liveTranscript]);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveTranscript, showTranscript]);

  // 首次打开面试官问候
  useEffect(() => {
    if (isStarted && isConnected && liveTranscript === '') {
      handleAiReply('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStarted, isConnected]);

  const getSystemInstruction = useCallback(() => {
    return `
    Role: You are a "Senior Project Management Expert" (资深项目管理专家) conducting a high-stakes interview for a Project Manager position at "${companyName}".

    IMPORTANT: You must speak Chinese (Mandarin) professionally.

    **STARTUP INSTRUCTION**:
    - As soon as the connection is established, you MUST speak first.
    - Greet the candidate: "你好，我是 ${companyName} 的面试官。很高兴能和你聊聊。今天的模拟面试大概需要20到30分钟。我会重点考察你的过往项目经历、冲突处理能力以及对项目管理的深度认知。那我们直接开始吧，请先做一个简单的自我介绍，重点讲讲你为什么觉得自己适合这个岗位？"

    **BEHAVIOR RULES**:
    1. **Self Introduction**: Look for "Role Fit" + "Capability Highlight" + "Motivation". Do not want a resume recitation.
    2. **Complex Projects (STAR)**: 
      - Failure Pattern: "I did X, then Y." (Task follower).
      - Success Pattern: "I identified risk A, built mechanism B, aligned stakeholder C." (Leader/Driver).
      - Ask about specific challenges (ambiguity, conflicts) if they are vague.
    3. **Stakeholder Conflict**:
      - Key: It's not about "communication", it's about "building mechanisms" (alignment meetings, risk escalation, consensus).
    4. **Project Delay**:
      - Key: Risk perception. How did they spot it early? Did they re-plan (trade-offs) or just work overtime? Transparency is key.

    Context:
    [JD Summary]: ${jdText.substring(0, 500)}...
    [Resume Summary]: ${resumeText.substring(0, 500)}...
    ${previousFeedback ? `[Previous History]: The candidate had score ${previousFeedback.score}. Weaknesses: ${previousFeedback.weaknesses.join(',')}. Check if they improved.` : ''}
    `;
  }, [companyName, jdText, resumeText, previousFeedback]);

  const startInterview = useCallback(() => {
    setIsStarted(true);
    setIsConnected(true);
    setError(null);
    transcriptRef.current = '';
    setLiveTranscript('');
    setElapsedSeconds(0);
    setRoundCount(0);
  }, []);

  const playAudioFromBuffer = useCallback(async (audioBuffer: ArrayBuffer) => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const decoded = await ctx.decodeAudioData(audioBuffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(ctx.destination);
      audioSourceRef.current = source;
      setIsAiSpeaking(true);
      source.onended = () => setIsAiSpeaking(false);
      source.start();
    } catch (err) {
      devError('[Interview] 音频播放失败:', err);
      setIsAiSpeaking(false);
    }
  }, []);

  const handleAiReply = useCallback(async (userMessage: string) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const messages = buildMessagesFromTranscript(transcriptRef.current);

      if (userMessage?.trim()) {
        const userText = userMessage.trim();
        transcriptRef.current += `${CANDIDATE_PREFIX}${userText}\n`;
        setLiveTranscript(prev => prev + `\n${CANDIDATE_PREFIX}${userText}\n`);
        messages.push({ role: 'user', content: userText });
      }

      const systemPrompt = getSystemInstruction();
      const aiText = await generateInterviewReply({ systemPrompt, conversation: messages });

      if (!aiText) throw new Error('面试官回复为空');

      transcriptRef.current += `${INTERVIEWER_PREFIX}${aiText}\n`;
      setLiveTranscript(prev => prev + `\n${INTERVIEWER_PREFIX}${aiText}\n`);

      try {
        const speech = await synthesizeSpeech(aiText);
        await playAudioFromBuffer(speech.arrayBuffer);
      } catch (ttsErr) {
        devError('[Interview] TTS 合成失败:', ttsErr);
        setIsAiSpeaking(false);
      }
    } catch (err) {
      devError('[Interview] AI 回复失败:', err);
      setError(err instanceof Error ? err.message : '获取面试官回复失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, getSystemInstruction, playAudioFromBuffer]);

  const handleSend = useCallback(async () => {
    if (!userInput.trim() || isLoading) return;
    const input = userInput;
    setUserInput('');
    await handleAiReply(input);
  }, [userInput, isLoading, handleAiReply]);

  const handleDisconnect = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    await cleanupAudioResources(audioSourceRef, audioContextRef);
    onFinish(transcriptRef.current);
  }, [onFinish]);

  useEffect(() => {
    return () => { cleanupAudioResources(audioSourceRef, audioContextRef); };
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // 判断是否达到建议结束轮次
  const hasReachedSuggestedRounds = roundCount >= SUGGESTED_ROUNDS;
  const hasReachedMinRounds = roundCount >= MIN_ROUNDS;

  if (!isStarted) {
    return (
      <div className="max-w-2xl mx-auto mt-6 md:mt-12 animate-fade-in px-4 md:px-6">
        <button onClick={onBack} className="mb-6 flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors text-sm font-medium">
          <ChevronLeft size={18} /> 返回
        </button>

        <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-slate-200 border border-slate-100 text-center relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <div className="relative z-10">
            <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-xl group-hover:scale-105 transition-transform duration-500">
              <Building2 size={36} />
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">即将连线面试官</h2>
            <p className="text-slate-500 text-base md:text-lg mb-8 max-w-md mx-auto leading-relaxed">
              <span className="font-bold text-slate-800">{companyName}</span> 的资深项目专家已在等候。<br />
              建议面试 {SUGGESTED_ROUNDS} 轮对话，约 15-20 分钟。
            </p>
            <button
              onClick={startInterview}
              className="px-10 md:px-12 py-4 md:py-5 bg-slate-900 text-white rounded-full font-bold text-lg shadow-2xl shadow-slate-400 hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all w-full max-w-xs flex items-center justify-center gap-3 mx-auto"
            >
              <Play size={24} className="fill-current" />
              开始面试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-2 md:mt-4 animate-fade-in px-2 md:px-4 h-[80vh] flex flex-col">
      <div className="bg-slate-900 rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-400 relative flex-1 flex flex-col border-2 md:border-4 border-slate-800">
        {/* Top Bar */}
        <div className="flex justify-between items-center p-4 md:p-6 z-20">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></div>
              <span className="text-slate-400 text-xs font-bold tracking-widest uppercase">
                {isConnected ? 'LIVE' : 'CONNECTING...'}
              </span>
            </div>
            <h2 className="text-white font-bold text-base md:text-lg">{companyName}</h2>
          </div>

          {/* 面试统计信息 */}
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <Clock size={14} className="text-slate-400" />
              <span className="text-white text-xs font-mono font-bold">{formatTime(elapsedSeconds)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <MessageCircle size={14} className="text-slate-400" />
              <span className={`text-xs font-bold font-mono ${hasReachedSuggestedRounds ? 'text-emerald-400' : 'text-white'}`}>
                {roundCount}/{SUGGESTED_ROUNDS}
              </span>
            </div>
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="bg-white/10 p-2 rounded-full text-white/70 hover:bg-white/20 transition-all backdrop-blur-md"
              title="切换对话记录"
            >
              {showTranscript ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </div>

        {/* 轮次提示 */}
        {hasReachedSuggestedRounds && !hasReachedMinRounds && (
          <div className="mx-4 mb-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-center">
            <span className="text-emerald-300 text-xs font-bold">
              🎯 已完成建议轮次！可以点击结束按钮生成面试报告，或继续深入练习
            </span>
          </div>
        )}
        {roundCount >= MAX_ROUNDS && (
          <div className="mx-4 mb-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-xl text-center">
            <span className="text-amber-300 text-xs font-bold">
              ⏰ 已进行 {roundCount} 轮对话，建议结束面试生成评估报告
            </span>
          </div>
        )}

        {/* Center: The Persona */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className={`absolute w-96 h-96 rounded-full bg-indigo-500/20 blur-[80px] transition-all duration-1000 ${
            isAiSpeaking ? 'scale-125 opacity-40' : 'scale-100 opacity-20'
          }`}></div>

          <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-b from-slate-700 to-slate-800 p-1 shadow-2xl relative mb-6 md:mb-8 transition-transform duration-500 ${
            isAiSpeaking ? 'scale-105' : 'scale-100'
          }`}>
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center relative overflow-hidden">
              <span className="text-5xl md:text-6xl filter drop-shadow-lg">👨‍💼</span>
              {isAiSpeaking && (
                <div className="absolute inset-0 rounded-full border-2 border-indigo-400/50 animate-ping"></div>
              )}
            </div>
          </div>

          {/* Status Text */}
          <div className="h-10">
            {isAiSpeaking ? (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 rounded-full border border-indigo-500/30 backdrop-blur-md">
                <AudioVisualizer isActive={true} color="bg-indigo-300" />
                <span className="text-indigo-200 text-xs font-bold uppercase tracking-wider">正在说话...</span>
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/20 rounded-full border border-amber-500/30 backdrop-blur-md">
                <span className="text-amber-200 text-xs font-bold uppercase tracking-wider animate-pulse">AI思考中...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-slate-300 text-xs font-bold uppercase tracking-wider">
                  {hasReachedMinRounds ? '可以结束或继续...' : '请输入回答...'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Transcript Overlay */}
        {showTranscript && (
          <div className="absolute bottom-32 left-0 w-full px-4 md:px-8 flex justify-center z-20 pointer-events-none">
            <div
              ref={scrollRef}
              className="bg-black/40 backdrop-blur-lg border border-white/10 p-3 md:p-4 rounded-2xl max-w-2xl w-full max-h-40 overflow-y-auto text-center"
            >
              <p className="text-white/90 text-sm font-medium leading-relaxed whitespace-pre-wrap">
                {liveTranscript || <span className="text-white/30 italic">等待对话开始...</span>}
              </p>
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="bg-slate-950 p-3 md:p-6 flex flex-col md:flex-row justify-center items-center gap-3 md:gap-8 z-30">
          <button
            onClick={() => setError('语音输入即将上线，当前请使用文字输入')}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all bg-white/10 text-white hover:bg-white/20"
            title="语音输入开发中"
          >
            <Mic size={22} />
          </button>

          <button
            onClick={handleDisconnect}
            className={`w-16 h-16 md:w-20 md:h-20 rounded-full text-white shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center ${
              hasReachedSuggestedRounds
                ? 'bg-emerald-600 shadow-emerald-900/50 hover:bg-emerald-700'
                : 'bg-rose-600 shadow-rose-900/50 hover:bg-rose-700'
            }`}
            title={hasReachedSuggestedRounds ? '结束面试并生成报告' : '结束面试'}
          >
            <PhoneOff size={28} fill="currentColor" />
          </button>

          <div
            className="w-full md:w-80 flex items-center gap-2 bg-slate-800 rounded-full px-4 py-2"
            style={{ opacity: isLoading ? 0.6 : 1 }}
          >
            <input
              type="text"
              className="flex-1 bg-transparent text-white text-sm outline-none px-1 placeholder-slate-500"
              placeholder="输入你的回答，Enter发送"
              value={userInput}
              autoComplete="off"
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !userInput.trim()}
              className={`p-2 rounded-full transition-all ${
                isLoading || !userInput.trim()
                  ? 'text-slate-500 cursor-not-allowed'
                  : 'text-white hover:bg-indigo-500/20 cursor-pointer'
              }`}
              aria-label="发送"
            >
              <MessageSquareText size={24} />
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-30 bg-rose-600/90 text-white px-4 py-2 rounded-lg text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 hover:underline">关闭</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewLiveView;
