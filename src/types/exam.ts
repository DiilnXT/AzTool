export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D';
  text: string;
  isCorrect?: boolean;
}

export interface Question {
  id: number;
  originalNumber: number;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D' | '';
  explanation?: string;
  image?: string;
}

export interface ExamMetadata {
  university: string;
  department?: string;
  semester: string;
  academicYear: string;
  subject: string;
  subjectNote?: string;
  durationMinutes: string;
  examDate: string;
  examMonth: string;
  examYear: string;
  examCode: string;
  note: string;
}

export interface ExamData {
  metadata: ExamMetadata;
  questions: Question[];
}

export interface MixedExam {
  code: string;
  questions: Question[];
  answerDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
}

export interface QuestionAuditError {
  questionNumber: number;
  severity: 'critical' | 'warning' | 'typo';
  title: string;
  description: string;
  suggestion: string;
  suggestedFixes?: {
    version: number;
    title: string;
    text: string;
    options: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    reason: string;
  }[];
}

export interface TabPermissions {
  canAudit: boolean;
  canStandardize: boolean;
  canMix: boolean;
  canPdfStudio?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'super_admin' | 'admin' | 'pro' | 'free';
  permissions?: TabPermissions;
  customApiKey?: string;
  customModelId?: string;
  createdAt: string;
  lastActive: string;
  examsGeneratedCount: number;
  mixCount: number;
}
