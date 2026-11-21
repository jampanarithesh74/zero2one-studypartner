export interface RevisionTopic {
  topic: string;
  priority: "High" | "Medium";
  whyImportant: string;
  noteRef: string;
}

export interface RevisionQuestion {
  marks: 2 | 5 | 10;
  question: string;
  keyPoints: string[];
  noteRef: string;
}

export interface RevisionChecklistItem {
  id: string;
  text: string;
}

export interface RevisionMcq {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  noteRef: string;
}

export interface RevisionPack {
  importantTopics: RevisionTopic[];
  importantQuestions: RevisionQuestion[];
  quickChecklist: RevisionChecklistItem[];
  mcqs: RevisionMcq[];
}

export interface RevisionRequestPayload {
  year: number | string;
  dept: string;
  sem: number | string;
  subject: string;
  unitTitle: string;
  fileUrl: string;
}
