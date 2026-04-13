import React from 'react';
import { FileSearch, Zap, TrendingUp, UserCheck, Briefcase, ArrowRight, ShieldCheck } from 'lucide-react';
import { AppStep } from '../types';

interface Props {
  onSelectScenario: (step: AppStep) => void;
}

const HomeView: React.FC<Props> = ({ onSelectScenario }) => {
  return (
    <div className="max-w-6xl mx-auto mt-12 px-6 animate-fade-in">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">
          PM 求职 <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">AI 智能教练</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
          无论你是需要深度打磨简历，还是只想进行面试冲刺，我们都能提供专业的 AI 辅助。
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Scenario 1: Full Process (Builder) */}
        <div 
          onClick={() => onSelectScenario(AppStep.JD_INPUT)}
          className="group relative bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 hover:shadow-2xl hover:border-violet-200 hover:-translate-y-2 transition-all cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-violet-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-8">
               <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center">
                 <Zap size={32} />
               </div>
               <span className="bg-violet-50 text-violet-700 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                 适合准备初期
               </span>
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 mb-3">全流程深度陪跑</h3>
            <p className="text-slate-500 mb-8 leading-relaxed h-12">
              从 JD 深度解析入手，通过 AI 诊断并重写简历，最后基于优化后的简历进行全真模拟。
            </p>

            <ul className="space-y-4 mb-10">
               <li className="flex items-center gap-3 text-sm text-slate-600">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">1</span>
                  JD 核心能力拆解与定级
               </li>
               <li className="flex items-center gap-3 text-sm text-slate-600">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">2</span>
                  简历 ATS 评分与 STAR 法则重写
               </li>
               <li className="flex items-center gap-3 text-sm text-slate-600">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">3</span>
                  基于新简历的针对性模拟面试
               </li>
            </ul>

            <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 group-hover:bg-violet-600 transition-colors">
              开始深度优化 <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Scenario 2: Fast Track (Runner) */}
        <div 
          onClick={() => onSelectScenario(AppStep.FAST_TRACK_SETUP)}
          className="group relative bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 hover:shadow-2xl hover:border-indigo-200 hover:-translate-y-2 transition-all cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-8">
               <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                 <UserCheck size={32} />
               </div>
               <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                 适合面试冲刺
               </span>
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 mb-3">实战模拟直通车</h3>
            <p className="text-slate-500 mb-8 leading-relaxed h-12">
              已有满意简历？跳过分析步骤，直接上传 JD 和简历，立即开启高压模拟面试。
            </p>

            <ul className="space-y-4 mb-10">
               <li className="flex items-center gap-3 text-sm text-slate-600">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">1</span>
                  快速导入目标 JD 与现有简历
               </li>
               <li className="flex items-center gap-3 text-sm text-slate-600">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">2</span>
                  AI 面试官自动生成考察题库
               </li>
               <li className="flex items-center gap-3 text-sm text-slate-600">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">3</span>
                  实时语音对练与复盘打分
               </li>
            </ul>

            <button className="w-full py-4 bg-white border-2 border-slate-100 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 group-hover:border-blue-500 group-hover:text-blue-600 transition-all">
              直接开始模拟 <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-20 flex justify-center text-slate-400 text-xs font-medium flex-col items-center gap-3">
         <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full">
            <ShieldCheck size={14} /> 数据安全承诺：您的简历仅用于 AI 分析，面试结束后自动清除
         </div>
      </div>
    </div>
  );
};

export default HomeView;