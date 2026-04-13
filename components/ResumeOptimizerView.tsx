import React, { useState, useRef, useEffect } from 'react';
import { ResumeOptimization, FileData, ChatMessage, ResumeImprovement } from '../types';
import { chatWithFeedback } from '../services/geminiService';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Wand2, AlertTriangle, Send, Upload, Image as ImageIcon, X, MessageSquare, ArrowRight, PenTool, Download, FileImage, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { devError } from '../utils/logger';

interface Props {
  optimization: ResumeOptimization | null;
  onAnalyze: (text: string, file?: FileData) => void;
  isLoading: boolean;
  onNext: () => void; // Now navigates to ResumeRewriteView
  jdContext?: string; 
  originalResumeText?: string;
}

interface FeedbackCardProps {
  item: ResumeImprovement;
}

// Progress Bar with Running Man
const SimulatedProgress = ({ label = "AI 正在逐字扫描简历并生成优化建议..." }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(old => {
        if (old >= 99) return 99;
        const remaining = 100 - old;
        const increment = Math.max(0.2, remaining * 0.05); 
        return Math.min(old + increment, 99);
      });
    }, 150);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full mt-8 relative">
       {/* Running Man */}
      <div 
        className="absolute bottom-3 transition-all duration-100 ease-linear"
        style={{ left: `calc(${progress}% - 24px)` }}
      >
        <span className="text-2xl filter drop-shadow-sm animate-bounce">🏃</span>
      </div>

      <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
        <div 
           className="h-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-100 ease-linear" 
           style={{ width: `${progress}%` }} 
        />
      </div>
      <div className="flex justify-between items-center mt-3">
         <p className="text-slate-500 text-xs font-medium tracking-wide animate-pulse">
           {label}
         </p>
         <span className="text-violet-600 text-sm font-bold font-mono">{Math.floor(progress)}%</span>
      </div>
    </div>
  );
};

// Formatted Chat Message to render bold text
const ChatBubbleText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

// Sub-component for individual feedback card with chat
const FeedbackCard: React.FC<FeedbackCardProps> = ({ item }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await chatWithFeedback(item.critique, item.original, item.suggestion, userMsg, chatHistory);
      setChatHistory(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
      devError(e);
      setChatHistory(prev => [...prev, { role: 'model', text: "抱歉，出了一点小问题，请重试。" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
             <AlertTriangle className="text-rose-500" size={20} />
             <span className="font-bold text-slate-800 text-lg">问题诊断</span>
          </div>
          <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold uppercase">
            {item.type}
          </span>
        </div>
        
        <div className="mb-6">
           <div className="text-xs font-bold text-slate-400 uppercase mb-1">原始描述</div>
           <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-slate-600 text-sm line-through decoration-rose-300">
             {item.original}
           </div>
        </div>

        <div className="mb-6">
           <div className="text-xs font-bold text-slate-400 uppercase mb-1">毒舌点评</div>
           <p className="text-rose-600 text-sm font-medium leading-relaxed">
             {item.critique}
           </p>
        </div>

        <div>
           <div className="text-xs font-bold text-slate-400 uppercase mb-1">优化建议</div>
           <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800 text-sm font-medium">
             {item.suggestion}
           </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center no-export">
         <span className="text-xs text-slate-500 font-medium">有疑问的话，点击右边按钮🔘，咱们聊聊这一条</span>
         <button 
           onClick={() => setIsChatOpen(!isChatOpen)}
           className={`flex items-center justify-center w-10 h-10 rounded-full transition-all
             ${isChatOpen ? 'bg-slate-300 text-white' : 'bg-violet-600 text-white shadow-lg shadow-violet-200 hover:scale-110 active:scale-95'}`}
         >
           <MessageSquare size={18} /> 
         </button>
      </div>

      {/* Chat Area */}
      {isChatOpen && (
        <div className="p-4 bg-slate-100 border-t border-slate-200 animate-fade-in no-export">
           <div className="space-y-4 mb-4 max-h-60 overflow-y-auto px-1">
              {chatHistory.length === 0 && (
                <div className="text-center py-4">
                   <p className="text-xs text-slate-400 mb-2">我是您的专属简历优化顾问</p>
                   <p className="text-sm text-slate-600 font-medium">“你还有其他更好的想法吗💡？”</p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm
                    ${msg.role === 'user' 
                      ? 'bg-slate-800 text-white rounded-br-none' 
                      : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'}`}
                  >
                    <ChatBubbleText text={msg.text} />
                  </div>
                </div>
              ))}
              {isTyping && (
                 <div className="flex justify-start">
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-slate-100 shadow-sm">
                       <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                       </div>
                    </div>
                 </div>
              )}
           </div>
           <div className="flex gap-2">
             <input 
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               placeholder="输入你的疑问..."
               className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-violet-500 shadow-sm"
             />
             <button onClick={handleSend} className="p-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 shadow-lg shadow-violet-200 transition-all">
               <Send size={18} />
             </button>
           </div>
        </div>
      )}
    </div>
  );
};


const ResumeOptimizerView: React.FC<Props> = ({ optimization, onAnalyze, isLoading, onNext, jdContext, originalResumeText }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<FileData | undefined>(undefined);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExport = async (type: 'image' | 'pdf') => {
    if (!exportRef.current || !optimization) return;
    setIsExporting(true);
    try {
      // Hide elements we don't want to export
      const elementsToHide = exportRef.current.querySelectorAll('.no-export');
      elementsToHide.forEach(el => ((el as HTMLElement).style.display = 'none'));

      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc', // match slate-50
      });

      // Restore elements
      elementsToHide.forEach(el => ((el as HTMLElement).style.display = ''));

      if (type === 'image') {
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = `Resume_Optimization.png`;
        link.click();
      } else {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`Resume_Optimization.pdf`);
      }
    } catch (error) {
      devError('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      try {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            setFile({
              mimeType: selectedFile.type,
              data: base64String
            });
          };
          reader.onerror = () => setUploadError("Oops，上传失败，请重新上传～");
          reader.readAsDataURL(selectedFile);
      } catch (err) {
          setUploadError("Oops，上传失败，请重新上传～");
      }
    }
  };

  const clearFile = () => {
    setFile(undefined);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const scoreData = optimization ? [{ value: optimization.matchScore }] : [];

  // --- Views ---

  if (!optimization) {
    return (
      <div className="max-w-xl mx-auto mt-8 animate-fade-in">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
           <div className="text-center mb-8">
            <div className="w-14 h-14 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wand2 size={28} />
            </div>
            <h2 className="text-2xl font-black text-slate-800">简历残酷诊断</h2>
            <p className="text-slate-500 mt-2 text-sm">拒绝恭维。AI 将客观指出你简历中与 JD 不匹配的硬伤。</p>
          </div>

           <div className="space-y-6">
             <textarea
              className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all resize-none text-sm font-mono"
              placeholder="在此粘贴简历内容..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isLoading}
            />

            {/* Divider */}
            <div className="relative flex items-center justify-center">
                 <div className="absolute border-t border-slate-200 w-full"></div>
                 <span className="relative bg-white px-3 text-xs text-slate-400 font-medium uppercase">或者</span>
            </div>

             <div className="flex flex-col gap-2">
               <div className="flex items-center gap-3">
                   <input 
                     type="file" 
                     ref={fileInputRef}
                     onChange={handleFileChange}
                     className="hidden"
                     accept="image/*,application/pdf"
                   />
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="flex-1 py-3 border-2 border-dashed border-slate-200 rounded-xl hover:border-violet-300 hover:bg-violet-50 text-slate-500 text-sm font-medium flex items-center justify-center gap-2 transition-all"
                     disabled={isLoading}
                   >
                     <Upload size={16} /> 上传简历附件
                   </button>
                   
                   {file && (
                     <div className="flex items-center gap-2 bg-violet-100 text-violet-700 px-4 py-3 rounded-xl text-sm font-bold">
                       <ImageIcon size={16} />
                       <button onClick={clearFile} disabled={isLoading} className="hover:text-violet-900"><X size={16}/></button>
                     </div>
                   )}
                </div>
                {uploadError && (
                  <p className="text-xs text-rose-500 font-medium text-center">{uploadError}</p>
                )}
            </div>
          </div>
         
          <div className="mt-8">
            {isLoading ? (
               <SimulatedProgress />
            ) : (
              <button
                onClick={() => (text.trim() || file) && onAnalyze(text, file)}
                disabled={(!text.trim() && !file)}
                className="w-full py-4 bg-violet-600 text-white rounded-2xl font-bold shadow-lg shadow-violet-200 hover:bg-violet-700 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2"
              >
                  <Wand2 size={20} /> 开始诊断
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // View: Optimization Results
  return (
    <div className="max-w-6xl mx-auto mt-6 px-4 pb-12 animate-fade-in">
      {/* Export Controls */}
      <div className="flex justify-end gap-3 mb-4 no-export">
        <button
          onClick={() => handleExport('image')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-violet-600 transition-all shadow-sm disabled:opacity-50"
        >
          <FileImage size={16} />
          {isExporting ? '导出中...' : '导出长图'}
        </button>
        <button
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-violet-600 transition-all shadow-sm disabled:opacity-50"
        >
          <FileText size={16} />
          {isExporting ? '导出中...' : '导出 PDF'}
        </button>
      </div>

      <div ref={exportRef} className="bg-slate-50 p-4 -mx-4 sm:mx-0 sm:p-6 rounded-3xl">
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Left Column: Score & Summary */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">JD 匹配度</h3>
              <div className="w-56 h-56 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart 
                    innerRadius="80%" 
                    outerRadius="100%" 
                    barSize={12} 
                    data={scoreData} 
                    startAngle={90} 
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar
                      background
                      dataKey="value"
                      cornerRadius={12}
                      fill={optimization.matchScore > 70 ? '#8b5cf6' : optimization.matchScore > 40 ? '#fbbf24' : '#f43f5e'}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-6xl font-black text-slate-800 tracking-tighter">{optimization.matchScore}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-900 p-8 rounded-[2rem] text-white">
               <h4 className="font-bold text-lg mb-4">综合诊断书</h4>
               <p className="text-slate-300 text-sm leading-7">
                 {optimization.executiveSummary}
               </p>
            </div>
          </div>

          {/* Right Column: Improvements Cards */}
          <div className="lg:col-span-8">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-2xl font-black text-slate-800">
                 优化建议 <span className="text-violet-600">({optimization.improvements.length})</span>
               </h3>
             </div>
             
             <div className="space-y-6">
               {optimization.improvements.map((item, idx) => (
                  <FeedbackCard key={idx} item={item} />
               ))}
             </div>
          </div>
        </div>
      </div>

      <div className="mt-12 flex justify-end no-export">
        <button 
          onClick={onNext}
          className="group px-8 py-4 bg-violet-600 text-white rounded-full font-bold shadow-xl shadow-violet-200 hover:bg-violet-700 transition-all flex items-center gap-3"
        >
          <PenTool size={20} /> 下一步：智能简历精修
        </button>
      </div>
    </div>
  );
};

export default ResumeOptimizerView;
