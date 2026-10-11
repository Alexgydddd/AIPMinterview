import React from 'react';
import { Download, RotateCcw, Check } from 'lucide-react';
import { InterviewFeedback } from '../types';
import { downloadText } from '../utils/download';
interface Props { feedback: InterviewFeedback; transcript: string; onRestart: () => void }
export default function UpsellView({ feedback, transcript, onRestart }: Props) {
  const report = [
    '项目经理模拟面试复盘', `练习参考分：${feedback.score} / 100`,
    '【表现亮点】', ...feedback.strengths.map(s => '- ' + s),
    '【待提升】', ...feedback.weaknesses.map(s => '- ' + s),
    '【下一次练习计划】', feedback.improvementPlan,
    feedback.growthEvaluation ? '【与上次相比】\n' + feedback.growthEvaluation : '',
    '【完整对话】', transcript,
  ].filter(Boolean).join('\n\n');
  return <div className="max-w-4xl mx-auto px-4 py-8">
    <div className="rounded-3xl bg-white border border-slate-200 p-6 md:p-10 shadow-sm">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
        <div><p className="text-xs font-bold text-violet-600 mb-2">本次练习已完成</p><h1 className="text-2xl font-bold text-slate-900">面试复盘报告</h1></div>
        <div className="text-right"><p className="text-xs text-slate-400">练习参考分</p><p className="text-4xl font-bold text-violet-600 mt-1">{feedback.score}<span className="text-sm text-slate-400"> / 100</span></p></div>
      </div>
      <div className="grid md:grid-cols-2 gap-5 mb-6">
        <section className="rounded-2xl bg-emerald-50 p-5"><h2 className="font-bold text-emerald-800 mb-4">表现亮点</h2><ul className="space-y-3">{feedback.strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700"><Check size={16} className="mt-1 shrink-0 text-emerald-600" />{s}</li>)}</ul></section>
        <section className="rounded-2xl bg-rose-50 p-5"><h2 className="font-bold text-rose-800 mb-4">下一次重点改善</h2><ul className="space-y-3">{feedback.weaknesses.map((s, i) => <li key={i} className="text-sm leading-relaxed text-slate-700">• {s}</li>)}</ul></section>
      </div>
      <section className="rounded-2xl bg-violet-50 p-5"><h2 className="font-bold text-violet-900 mb-3">下一次练习计划</h2><p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{feedback.improvementPlan}</p></section>
      {feedback.growthEvaluation && <section className="mt-5 p-5 rounded-2xl bg-blue-50"><h2 className="font-bold mb-3 text-blue-900">与上次相比</h2><p className="text-sm leading-relaxed text-slate-700">{feedback.growthEvaluation}</p></section>}
      <p className="text-xs text-slate-400 mt-6 leading-relaxed">评分依据本次对话，仅用于练习，不代表真实招聘结果。请先核对建议，再用于下一次练习。</p>
      <div className="flex flex-wrap gap-3 mt-8">
        <button onClick={() => downloadText('项目经理面试复盘.txt', report)} className="px-5 py-3 rounded-xl border border-violet-200 text-violet-700 text-sm font-bold flex gap-2 items-center"><Download size={17} />下载报告与对话</button>
        <button onClick={onRestart} className="px-5 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold flex gap-2 items-center"><RotateCcw size={17} />针对弱项再练一次</button>
      </div>
      <details className="mt-8 border-t border-slate-100 pt-5"><summary className="text-sm text-slate-500 cursor-pointer">查看本次完整对话</summary><p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-600 mt-4">{transcript}</p></details>
    </div>
  </div>;
}
