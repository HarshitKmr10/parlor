import { nocApiInstance } from "api/common/axiosInstance";
import { AIAgent } from "./models";

export const getAIAgents = async (): Promise<AIAgent[]> => {
    return await nocApiInstance.get("api/v1/agents/definitions").then((res) => res.data);
};