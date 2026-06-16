import { aiAgentInstance, serviceDeskInstance } from "api/common/axiosInstance";
import { API_ENDPOINTS } from "constants/dashboard";
import { UserType } from "types/common";

export type RecommendationType = 'merge' | 'create_new_kb' | 'refactor';

export interface Article {
    id: string;
    number: string;
    name: string;
    score: number;
    collection_name?: string;
    url?: string;
    content?: string;
    status: "inserted" | "processed" | "failed";
    error_message?: string;
}

interface TicketData {
    Number: string;
    'Short description': string;
    Category: string;
    Priority: string;
    State: string;
}

interface Recommendation {
    id: string;
    recommendation: string;
    type: string;
    rank: number;
    related_to_kb_ids: string[];
    incidents: string[];
    metadata: {
        ticket_data: TicketData;
    };
}

export const fetchAllDocuments = async (
    user: UserType,
    documents_type: "all" | "refactor" | "missing_translation" = "all",
    page = 1,
    limit = 10,
    search_query = "",
    signal?: AbortSignal,
    sort_by?: string,
    sort_order: "asc" | "desc" = "desc",
    collection_id?: string,
    language?: string,
    has_duplicate?: boolean | null,
    score_params?: Record<string, number>
): Promise<{ data: Article[], total_count: number }> => {

    let url = `${API_ENDPOINTS.ALL_DOCUMENTS}?documents_type=${documents_type}&page=${page}&limit=${limit}&search_query=${search_query}`;

    if (sort_by) {
        url += `&sort_by=${sort_by}&sort_order=${sort_order}`;
    }

    if (collection_id) {
        url += `&collection_id=${collection_id}`;
    }

    if (language) {
        url += `&language=${language}`;
    }

    if (has_duplicate !== null && has_duplicate !== undefined) {
        url += `&has_duplicate=${has_duplicate ? 1 : 0}`;
    }

    if (score_params) {
        Object.entries(score_params).forEach(([key, value]) => {
            url += `&${key}=${value}`;
        });
    }

    const response = await serviceDeskInstance.get(url, { signal });

    if (response.status !== 200) {
        throw new Error(`API request failed: ${response.status}`);
    }

    return response.data;
};

export const fetchRecommendations = async (
    recommendationType: RecommendationType,
    user: UserType,
    page = 1,
    limit = 10,
    search_query = "",
    signal?: AbortSignal,
    sort_by?: string,
    sort_order: "asc" | "desc" = "desc"
): Promise<{ data: Recommendation[], total_count: number }> => {
    let url = `${API_ENDPOINTS.ALL_ARTICLES}?recommendation_type=${recommendationType}&page=${page}&limit=${limit}&search_query=${search_query}`;
    
    if (sort_by) {
        url += `&sort_by=${sort_by}&sort_order=${sort_order}`;
    }
    
    const response = await aiAgentInstance.get(url, { signal });

    if (response.status !== 200) {
        throw new Error(`API request failed: ${response.status}`);
    }

    return response.data;
};

export const ignoreRecommendation = async (
    recommendationId: string,
    signal?: AbortSignal
): Promise<{ id: string; already_resolved?: boolean }> => {
    const url = `${API_ENDPOINTS.ALL_ARTICLES}/${recommendationId}/ignore`;
    console.log('[ignoreRecommendation] POST', url);

    try {
        const response = await aiAgentInstance.post(url, null, { signal });
        console.log('[ignoreRecommendation] response', {
            id: recommendationId,
            status: response.status,
            data: response.data,
        });

        if (response.status !== 200) {
            throw new Error(`API request failed: ${response.status}`);
        }

        return response.data.data;
    } catch (err) {
        console.error('[ignoreRecommendation] failed', { id: recommendationId, err });
        throw err;
    }
};
