export interface PostcallTopic {
    id: string;
    created_at: string;
    meeting_id: string;
    topic: string;
    queries_regarding_topic: string[];
    speakers: string[];
    keywords: string[];
    resources_for_the_topic: any[]; // Could be more specific based on actual data
    content: string;
    kb_entry: string;
    meetings?: {
        title: string;
    };
    is_approved?: boolean;
    approved_by?: string;
    approved_at?: string;
    knowledgebase_collection_id?: string;
    kb_collection?: {
        name: string;
    };
}

export interface PostcallTopicsResponse {
    message: string;
    data: PostcallTopic[];
}

export interface PostcallTopicListView {
    id: string;
    created_at: string;
    meeting_id: string;
    topic: string;
    meetings?: {
        title: string;
    };
    knowledgebase_collection_id?: string;
    kb_collection?: {
        name: string;
    };
    is_approved?: boolean;
    approved_by?: string;
    approved_at?: string;
}

export interface PostcallTopicListViewResponse {
    message: string;
    data: PostcallTopicListView[];
}




export interface KBEntryVersion {
    id: string;
    kb_entry: string;
    created_at: string;
    user?: {
        email?: string;
        name?: string;
    };
}
