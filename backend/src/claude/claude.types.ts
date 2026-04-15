export type AIIssueCategory =
  | 'SECURITY'
  | 'PERFORMANCE'
  | 'QUALITY'
  | 'STYLE'
  | 'DOCUMENTATION'
  | 'TESTING'
  | 'DEPENDENCIES';

export type AIIssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AIIssue {
  category: AIIssueCategory;
  severity: AIIssueSeverity;
  title: string;
  description: string;
  suggestion?: string;
  lineStart?: number;
  lineEnd?: number;
  fileName?: string;
}

export interface AIReviewResult {
  overallScore: number; // 0–100
  summary: string;
  issues: AIIssue[];
}
