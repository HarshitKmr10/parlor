export interface TrainAssistMetrics {
  totalLearnersEnrolled: number;
  averageQuizScore: number; // as decimal (e.g., 0.78 for 78%)
  simulationCompletionRate: number; // as decimal (e.g., 0.47 for 47%)
  dropOffRateAfterModules: number; // as decimal (e.g., 0.18 for 18%)
}

export interface OverallProgressData {
  topicsStarted: number;
  quizzesAttempted: number;
  simulationsDone: number;
}

export interface Employee {
  id: string;
  name: string;
  avatar: string;
  topics: number;
  modulesStarted: number;
  avgQuizScore: string;
  simulationsDone: number;
  avgScore: string;
}

export interface CollectionData {
  name: string;
  completion: number;
}

export interface ModulePerformanceData {
  name: string;
  topicsCompleted: number;
  avgQuizScore: number;
  simulationsCompleted: number;
} 