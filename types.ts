
export interface SkillCard {
  name: string;
  type: 'Hard' | 'Soft'; // Hard Skills vs Soft Skills
  priority: 'High' | 'Medium' | 'Low';
  description: string;
  applicationScenario: string; // How this applies to the specific company/industry
}

export interface JdAnalysis {
  companyName: string;
  industry: string;
  companyProducts: string[];
  skills: SkillCard[];
  persona: string;
  level: 'Entry' | 'Mid-Level' | 'Senior' | 'Executive';
}

export interface ResumeImprovement {
  id: string;
  type: 'Format' | 'Content' | 'Impact';
  original: string;
  critique: string; // Objective/Critical feedback
  suggestion: string; // The fix
  chatHistory: ChatMessage[]; // Local chat history for this specific card
}

export interface ResumeOptimization {
  matchScore: number;
  executiveSummary: string; // Brutally honest summary
  improvements: ResumeImprovement[];
}

// Updated Interface for the Refined Resume response
export interface RefinedResumeResponse {
  // New section: Explain what changed and why
  optimizationLogic: {
    changesMade: string; // "We optimized section X, Y, Z..."
    reasoning: string;   // "To match JD requirements A, B, C..."
  };
  resume: {
    baseInfo: {
      name: string;
      phone: string;
      email: string;
      objective: string;
    };
    summary: string; // Section 2: One sentence core competency
    workExperience: {
      company: string;
      role: string;
      date: string;
      // Section 3: Capability points matching JD
      points: string[]; 
    }[];
    projectExperience: {
      // Section 4: Specific 5-row structure
      role: string;
      name: string;
      date: string;
      brief: string;      // Line 2: Background + Responsibilities
      difficulty: string; // Line 3: Difficulties (Urgency, Standards, etc.)
      solution: string;   // Line 4: PM Solutions
      result: string;     // Line 5: Quantified Results
    }[];
    education: {
      // Section 5: Education details
      degree: string;
      school: string;
      major: string;
      date: string;
    }; 
  }
}

export interface InterviewFeedback {
  score: number;
  strengths: string[];
  weaknesses: string[];
  improvementPlan: string; // Detailed advice
  growthEvaluation?: string; // New: Growth comparison with previous session
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}

export enum AppStep {
  HOME = 0,
  
  // Flow 1: Full Prep
  JD_INPUT = 1,
  JD_ANALYSIS = 2,
  RESUME_INPUT = 3,
  RESUME_OPTIMIZATION = 4,
  RESUME_REWRITE = 5,
  
  // Flow 2: Fast Track
  FAST_TRACK_SETUP = 10,

  // Shared
  MOCK_INTERVIEW = 6,
  INTERVIEW_FEEDBACK = 7,
  UPSELL = 8
}

export interface FileData {
  mimeType: string;
  data: string; // base64
}
