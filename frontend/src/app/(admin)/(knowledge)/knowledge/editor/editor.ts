export interface KBDocument {
    access_url: string;
    id: string;
    title: string;
    content: string;
    collection_id?: string;
    collection_name?: string;
    // Add other document properties as needed
  }
  
  export interface DocumentStatistics {
    score: number;
  clarity?: number;
  suggested_changes?: string[];
  }
  
  export interface EditorBaseProps {
    document: KBDocument;
    onClose: () => void;
    onSave?: (updatedContent: string) => Promise<void>;
  }