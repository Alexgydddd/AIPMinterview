import React from 'react';
import { Check, Star, Users, ArrowRight, RotateCcw, TrendingUp } from 'lucide-react';
import { InterviewFeedback } from '../types';

interface Props {
  feedback?: InterviewFeedback | null;
  onRestart: () => void;
}

const UpsellView: React.FC<Props> = ({ feedback, onRestart }) => {
  return (
    <div className="max-w-4xl mx-auto mt-10 p-8 bg-white rounded-2xl shadow-xl border border-indigo-50 animate-fade-in text-center pb-20">
      
      {feedback && (
        <div className="mb-10 bg-slate-50 p-8 rounded-[2rem] text-left border border-slate-100 shadow-sm relative overflow-hidden">
           {/* Header with Score */}
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                 <div className="p-2 bg-yellow-100 text-yellow-600 rounded-xl"><Star size={24} fill="currentColor"/></div>
                 面试评估报告
              </h2>
              <div className="flex items-center gap-3">
                 <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">综合表现得分</span>
                 <div className="text-5xl font-black text-violet-600 tracking-tighter">{feedback.score}</div>
              </div>
           </div>
           
           {/* Strengths & Weaknesses Grid */}
           <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                 <div className="text-xs font-bold text-emerald-600 uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 表现亮点 (Strengths)
                 </div>
                 <ul className="space-y-2">
                    {feedback.strengths.map((s, i) => (
                       <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                          <Check size={14} className="mt-1 text-emerald-500 shrink-0"/> {s}
                       </li>
                    ))}
                 </ul>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                 <div className="text-xs font-bold text-rose-500 uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> 待提升 (Weaknesses)
                 </div>
                 <ul className="space-y-2">
                    {feedback.weaknesses.map((w, i) => (
                       <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="mt-1 w-1 h-1 bg-rose-400 rounded-full shrink-0"/> {w}
                       </li>
                    ))}
                 </ul>
              </div>
           </div>

           {/* Growth Evaluation (if exists) */}
           {feedback.growthEvaluation && (
              <div className="mb-8 bg-blue-50/50 border border-blue-100 p-5 rounded-2xl">
                 <div className="text-xs font-bold text-blue-600 uppercase mb-2 flex items-center gap-2">
                    <TrendingUp size={16} /> 成长轨迹对比
                 </div>
                 <p className="text-sm text-blue-900 leading-relaxed">
                    {feedback.growthEvaluation}
                 </p>
              </div>
           )}
           
           {/* Improvement Plan */}
           <div className="bg-violet-50/50 p-6 rounded-2xl border border-violet-100">
             <h4 className="font-bold text-violet-900 mb-3 text-sm uppercase tracking-wider">专家改进建议</h4>
             <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                {feedback.improvementPlan}
             </p>
           </div>
        </div>
      )}

      {/* Prominent Restart Action - Placed ABOVE the "Well Done" section as requested */}
      <div className="mb-12">
         <button 
            onClick={onRestart}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-full font-bold shadow-xl shadow-slate-300 hover:scale-105 transition-all overflow-hidden"
         >
            <div className="absolute inset-0 bg-white/10 group-hover:bg-white/20 transition-colors"></div>
            <RotateCcw size={20} className="group-hover:-rotate-180 transition-transform duration-500"/> 
            <span>再练一次 (带记忆模式)</span>
         </button>
         <p className="text-xs text-slate-400 mt-3">
            AI 面试官将基于本次反馈，针对你的弱项进行针对性提问
         </p>
      </div>

      <div className="border-t border-slate-100 pt-10">
         <h2 className="text-2xl font-black text-slate-800 mb-4">做得好！第一步已经完成</h2>
         <p className="text-slate-500 max-w-2xl mx-auto mb-10 text-sm leading-relaxed">
            AI 模拟能帮你消除 80% 的紧张感。但如果你面对的是年薪 50w+ 的核心岗位，<br/>
            建议预约资深专家的 1对1 陪跑服务，解决剩下的 20% 关键卡点。
         </p>

         <div className="grid md:grid-cols-2 gap-6 text-left max-w-3xl mx-auto">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 relative opacity-60 hover:opacity-100 transition-opacity">
               <div className="absolute top-4 right-4 text-xs font-bold text-slate-400">当前版本</div>
               <h3 className="text-lg font-bold text-slate-800 mb-4">AI 智能教练</h3>
               <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2 text-slate-600"><Check size={14} className="text-emerald-500"/> JD 关键词自动提取</li>
                  <li className="flex items-center gap-2 text-slate-600"><Check size={14} className="text-emerald-500"/> 简历 ATS 评分与优化</li>
                  <li className="flex items-center gap-2 text-slate-600"><Check size={14} className="text-emerald-500"/> 语音模拟面试 & 基础反馈</li>
               </ul>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-2xl text-white relative shadow-xl shadow-indigo-200 transform md:scale-105">
               <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                  OFFER 保障
               </div>
               <h3 className="text-lg font-bold mb-1">专家 1对1 陪跑</h3>
               <p className="text-indigo-200 text-xs mb-4">针对高薪/核心岗位的冲刺服务。</p>
               <ul className="space-y-3 text-sm mb-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-yellow-300"/> 包含 AI 教练所有功能</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-yellow-300"/> 资深 PM 深度精修简历</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-yellow-300"/> 60分钟真人实战模拟</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-yellow-300"/> 薪资谈判策略指导</li>
               </ul>
               
               <button className="w-full bg-white text-indigo-700 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex justify-center items-center gap-2 text-sm">
                  预约免费咨询 <ArrowRight size={16}/>
               </button>
            </div>
         </div>
      </div>
      
      <div className="mt-12 flex items-center justify-center gap-2 text-xs text-slate-400">
         <Users size={14} /> 今年已有 200+ PM 通过 1对1 服务拿到 Offer
      </div>

    </div>
  );
};

export default UpsellView;
