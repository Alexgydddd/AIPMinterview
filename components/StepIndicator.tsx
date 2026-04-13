import React from 'react';
import { AppStep } from '../types';
import { FileSearch, FileText, UserCheck, PieChart, Home, PenTool, Zap } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: AppStep;
  onNavigate: (step: AppStep) => void;
  isFastTrack: boolean;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, onNavigate, isFastTrack }) => {
  if (currentStep === AppStep.HOME) return null;

  // Define steps based on the flow mode
  const steps = isFastTrack 
    ? [
        { id: AppStep.FAST_TRACK_SETUP, target: AppStep.FAST_TRACK_SETUP, label: '面试配置', icon: Zap },
        { id: AppStep.MOCK_INTERVIEW, target: AppStep.MOCK_INTERVIEW, label: '实战模拟', icon: UserCheck },
        { id: AppStep.INTERVIEW_FEEDBACK, target: AppStep.INTERVIEW_FEEDBACK, label: '复盘', icon: PieChart },
      ]
    : [
        { id: AppStep.JD_INPUT, target: AppStep.JD_INPUT, label: 'JD 解析', icon: FileSearch },
        { id: AppStep.RESUME_INPUT, target: AppStep.RESUME_INPUT, label: '简历诊断', icon: FileText },
        { id: AppStep.RESUME_REWRITE, target: AppStep.RESUME_REWRITE, label: '简历精修', icon: PenTool },
        { id: AppStep.MOCK_INTERVIEW, target: AppStep.MOCK_INTERVIEW, label: '实战模拟', icon: UserCheck },
        { id: AppStep.INTERVIEW_FEEDBACK, target: AppStep.INTERVIEW_FEEDBACK, label: '复盘', icon: PieChart },
      ];

  // Calculate Active Index logic
  let activeIndex = 0;
  
  if (isFastTrack) {
    if (currentStep === AppStep.FAST_TRACK_SETUP) activeIndex = 0;
    else if (currentStep === AppStep.MOCK_INTERVIEW) activeIndex = 1;
    else if (currentStep >= AppStep.INTERVIEW_FEEDBACK) activeIndex = 2;
  } else {
    if (currentStep === AppStep.JD_INPUT || currentStep === AppStep.JD_ANALYSIS) activeIndex = 0;
    else if (currentStep === AppStep.RESUME_INPUT || currentStep === AppStep.RESUME_OPTIMIZATION) activeIndex = 1;
    else if (currentStep === AppStep.RESUME_REWRITE) activeIndex = 2;
    else if (currentStep === AppStep.MOCK_INTERVIEW) activeIndex = 3;
    else if (currentStep >= AppStep.INTERVIEW_FEEDBACK) activeIndex = 4;
  }

  return (
    <div className="w-full py-4 px-6 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        {/* Home Button */}
        <button
          onClick={() => onNavigate(AppStep.HOME)}
          className="p-3 rounded-2xl bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-all mr-4 flex-shrink-0"
          title="返回首页"
        >
          <Home size={20} />
        </button>

        <div className="flex-1 flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === activeIndex;
            const isCompleted = index < activeIndex;
            
            // Can navigate if completed or current
            const isClickable = index <= activeIndex;

            return (
              <React.Fragment key={step.id}>
                <button 
                  onClick={() => isClickable && onNavigate(step.target)}
                  disabled={!isClickable}
                  className={`flex flex-col items-center group transition-all duration-300 ${isClickable ? 'cursor-pointer' : 'cursor-default opacity-50'}`}
                >
                  <div 
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
                      ${isActive 
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 scale-110 rotate-3' 
                        : isCompleted 
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                          : 'bg-white border border-slate-100 text-slate-300'}`}
                  >
                    <Icon size={20} />
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider mt-2 font-bold ${isActive ? 'text-violet-600' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                </button>
                
                {index < steps.length - 1 && (
                  <div className="flex-1 h-[2px] mx-4 bg-slate-100 relative rounded-full overflow-hidden">
                    <div 
                        className="absolute top-0 left-0 h-full bg-violet-600 transition-all duration-500 ease-out"
                        style={{ width: isCompleted ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StepIndicator;