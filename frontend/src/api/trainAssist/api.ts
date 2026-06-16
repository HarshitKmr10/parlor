import { serviceDeskInstance } from "api/common/axiosInstance";

export const updateTrainAssistConfig = async (
    collectionIds: string[], 
    passingScore: number, 
    numQuestions: number
) => {
    return await serviceDeskInstance.post(`service_desk/train_assist/update_config`, {
        collection_ids: collectionIds,
        passing_score: passingScore,
        num_questions: numQuestions,
    });
};
