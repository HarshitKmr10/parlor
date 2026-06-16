export interface ComparisonSummary {
  summary_title: string;
  description: string;
  key_highlights: string[];
  similarity_score: number;
  unique_content_retained: number;
  merge_confidence: 'High' | 'Medium' | 'Low';
}

export interface Recommendation {
  id?: string;
  recommendation?: string;
  type: 'create_new_kb' | 'refactor' | 'merge' | 'missing_translation';
  rank?: number;
  related_to_kb_ids?: Array<{
    id: string;
    number: string;
    title: string;
    access_url: string;
  }>;
  metadata?: any | null;
  kb_data?: ArticleData[];
  content?: string;
  ticket_data?: any[];
  justification?: Array<{
    heading: string;
    reason: string;
    ticket_link: string;
    ticket_id: string;
  }>;
  suggestions?: string[];
  kb_score?: number;
  improvement_suggestions?: string[][];
  statistics?: any;
  title?: string;
  resolved?: boolean;
  translating_from_language?: string;
  translating_to_language?: string;
  selected_template_id?: number | null;
  comparison_summary?: ComparisonSummary;
}

export interface Issue {
  id: string;
  name: string;
  ticketdata: any[];
  type: 'create_new_kb' | 'refactor' | 'merge' | 'missing_translation';
}

export interface DashboardData {
  total_duplicate_documents: number;
  total_documents: number;
  total_missing_translations: number;
  ticket_features_enabled?: boolean;
  create_new_kb_recommendations_count?: number;
  unlinked_incidents_count?: number;
  missed_linked_incidents_count?: number;
  low_scoring_articles: Array<{
    name: string;
    score: number;
  }>;
  recommendations: Recommendation[];
  common_issues: Array<{
    name: string;
    incidents: string[];
    category: string;
  }>;
  kb_quality_data: Array<{
    date: string;
    deduplicatedKBs: number;
    createdKBs: number;
    totalKBs: number;
  }>;
}

export interface DashboardStats {
  label: string;
  value: string | number;
  tooltip: string;
}

export interface ViewProps {
  recommendation: Recommendation;
  onSetView: (view: ViewType) => void;
}

export type ViewType = 'dashboard' | 'merge' | 'refactor' | 'create_new_kb' | 'edit' | 'outdated' | 'missing_translation';

export interface EditorProps {
  initialContent: string;
  updatedContent: string;
  showCompareChanges: boolean;
  onContentChange: (content: string) => void;
  onToggleCompareChanges: () => void;
  setUpdatedContent: (content: string) => void;
  setShowCompareChanges: (show: boolean) => void;
  onModeChange: (showCompare: boolean) => void;
}

export enum KbCollectionSource {
  SERVICE_NOW = "service_now",
  AZURE_BLOB = "azure_blob",
  SHAREPOINT = "sharepoint",
  S3 = "s3",
}

export interface ArticleData {
  id: string;
  number: string;
  name: string;
  score: number;
  access_url: string;
  content?: string;
  kb_collection?: {
    source: KbCollectionSource;
  };
}
