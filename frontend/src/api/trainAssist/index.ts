import { serviceDeskInstance, aiAgentInstance } from "api/common/axiosInstance";

/**
 * Interface for Train Assist Activity
 */
export interface TrainAssistActivity {
    id: string;
    created_at: string;
    user_id: string;
    topic_id: string;
    type: 'quiz' | 'simulation';
}

/**
 * Interface for Train Assist Topic
 */
export interface TrainAssistTopic {
    id: string;
    org_id: string;
    title: string;
    details: {
        modules: {
            title: string;
            content: string;
            document_references: {
                id: string;
                name: string;
            }[];
        }[];
    };
    created_at: string;
    updated_at: string;
    train_assist_activity?: TrainAssistActivity[]; // Activity records for the current user
}

/**
 * Interface for Quiz Question
 */
export interface QuizQuestion {
    question: string;
    options: string[];
    explanation?: string;
}

/**
 * Interface for Quiz
 */
export interface Quiz {
    title: string;
    questions: QuizQuestion[];
}

/**
 * Interface for Quiz Response
 */
export interface QuizResponse {
    quiz_id: string;
    quiz: Quiz;
}

/**
 * Interface for Session Variables
 */
export interface SessionVariables {
    session_id: string;
    org_id: string;
    app_id: string;
    return_context?: boolean;
}

/**
 * Interface for Train Assist Chat Request
 */
export interface TrainAssistChatRequest {
    messages: Array<{
        role: string;
        content: string;
    }>;
    session_variables: SessionVariables;
    topic_id: string;
}

/**
 * Interface for Response Message Content
 */
export interface ResponseMessageContent {
    user: any | null;
    assistant: string;
}

/**
 * Interface for Response Aids
 */
export interface ResponseAids {
    citations: any[];
    session_title: string;
    language_code?: string;
    context?: any;
    quick_replies?: string[];
    follow_up_questions?: string[];
    optimized_query?: string | null;
    duplicate_question_identified?: any | null;
    escalate_to_human?: boolean;
}

/**
 * Interface for User Data
 */
export interface UserData {
    employee_id?: string;
    employee_name?: string;
    email?: string;
    phone_number?: string;
}

/**
 * Interface for Train Assist Chat Response
 */
export interface TrainAssistChatResponse {
    error: null;
    data: {
        response_message_content: ResponseMessageContent;
        response_aids: ResponseAids;
        user_data: UserData | null;
    };
    meta: any | null;
}

/**
 * Interface for Knowledgebase Collection
 */
export interface KnowledgebaseCollection {
    id: string;
    name: string;
    org_id: string;
    source: string;
    source_config?: any;
    created_at: string;
    last_synced_at?: string;
}

/**
 * Get all train assist topics for the current organization
 * @param collectionId - Optional collection ID to filter topics by
 * @returns Promise with the list of train assist topics
 */
export const getTrainAssistTopics = async (collectionId?: string): Promise<TrainAssistTopic[]> => {
    const params = collectionId ? { collection_id: collectionId } : {};
    const response = await serviceDeskInstance.get('/service_desk/train_assist_topics', { params });
    return response.data;
};

/**
 * Get a specific train assist topic by ID
 * @param topicId - The ID of the train assist topic to retrieve
 * @returns Promise with the train assist topic
 */
export const getTrainAssistTopicById = async (topicId: string): Promise<TrainAssistTopic> => {
    const response = await serviceDeskInstance.get(`/service_desk/train_assist_topic/${topicId}`);
    return response.data;
};

/**
 * Generate a quiz for a train assist topic
 * @param topicId - The ID of the train assist topic
 * @param numQuestions - Number of questions to generate (default: 5)
 * @returns Promise with the generated quiz data
 */
export const generateTrainAssistQuiz = async (
    topicId: string,
    numQuestions = 5
): Promise<QuizResponse> => {
    const response = await aiAgentInstance.post(
        `/api/v1/train-assist/${topicId}/generate-quiz`,
        null,
        { params: { num_questions: numQuestions } }
    );

    // The backend returns { quiz_id, quiz } structure
    return response.data;
};

/**
 * Get the quiz for a train assist topic
 * @param topicId - The ID of the train assist topic
 * @returns Promise with the quiz data
 */
export const getTrainAssistQuiz = async (topicId: string): Promise<{ error: null, data: QuizResponse, meta: null }> => {
    const response = await aiAgentInstance.get(`/api/v1/train-assist/${topicId}/quiz`);
    return response.data;
};

/**
 * Check answers for a train assist quiz
 * @param quizId - The ID of the quiz
 * @param answers - Array of selected answer indices (0-3)
 * @returns Promise with the score and feedback
 */
export const checkQuizAnswers = async (
    quizId: string,
    answers: number[]
): Promise<{
    error: null,
    data: {
        score: number,
        correct_count: number,
        total_questions: number,
        feedback: Array<{
            question_index: number,
            is_correct: boolean,
            correct_answer: number,
            explanation: string
        }>
    },
    meta: {
        message: string
    }
}> => {
    const response = await aiAgentInstance.post(
        `/api/v1/train-assist/quiz/${quizId}/check-answers`,
        { answers }
    );
    return response.data;
};

/**
 * Send a chat message to the Train Assist V2 endpoint
 * @param messages - Array of conversation messages
 * @param sessionVariables - Session variables for the conversation
 * @param topicId - ID of the training topic to use for context
 * @returns Promise with the AI response
 */
export const trainAssistChatV2 = async (
    messages: Array<{ role: string; content: string }>,
    sessionVariables: SessionVariables,
    topicId: string
): Promise<TrainAssistChatResponse> => {
    const requestBody: TrainAssistChatRequest = {
        messages,
        session_variables: sessionVariables,
        topic_id: topicId
    };

    const response = await aiAgentInstance.post(
        '/api/v2/chat/train-assist',
        requestBody
    );

    return response.data;
};

/**
 * Get all collections associated with train assist topics for the organization
 * @returns Promise with the list of knowledgebase collections
 */
export const getTrainAssistCollections = async (): Promise<KnowledgebaseCollection[]> => {
    const response = await serviceDeskInstance.get('/service_desk/train_assist_collections');
    return response.data;
};

export const postTrainAssistModuleCompletion = async (topicId: string, moduleId: string): Promise<void> => {
    const response = await aiAgentInstance.post(`/api/v1/train-assist/${topicId}/module-completion`, { module_id: moduleId });
    return response.data;
};


/**
 * Sync the selected train assist collections with the backend
 * @param collectionIds - Array of selected collection IDs to sync
 * @returns Promise with per-collection sync results
 */
export const syncTrainAssistCollections = async (
  collectionIds: string[]
): Promise<{
  error: null;
  data: {
    results: {
      [collectionId: string]: {
        success: boolean;
        data?: any;
        error?: string;
      };
    };
  };
  meta: {
    message: string;
  };
}> => {
  const response = await aiAgentInstance.post(
    '/api/v2/train-assist/collections/sync',
    { collection_ids: collectionIds }
  );
  return response.data;
};


export * from './api';
