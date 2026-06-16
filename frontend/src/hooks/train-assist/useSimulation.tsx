import { useState, useEffect } from "react";
import { aiAgentInstance } from "api/common/axiosInstance";

// ─── Types ───────────────────────────────────────────────────────
export interface SimulationThemeResponse {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  difficulty: string;
  time_limit_seconds: number;
  learning_topic_title: string;
}

// ─── API Call ─────────────────────────────────────────────────────
export async function getSimulationThemesForGuide(guideId: string): Promise<SimulationThemeResponse[]> {
  const response = await aiAgentInstance.get<SimulationThemeResponse[]>(
    `/api/v2/train-assist/simulations/themes/guide/${guideId}`
  );
  return response.data;
}

// ─── Hook ─────────────────────────────────────────────────────────
export function useSimulationThemes(guideId: string) {
  const [data, setData] = useState<SimulationThemeResponse[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guideId) return;

    const fetchThemes = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await getSimulationThemesForGuide(guideId);
        setData(result);
      } catch (err: any) {
        if (err.response) {
          setError(`Server error: ${err.response.status} ${err.response.statusText}`);
        } else if (err.request) {
          setError("No response received. Please check your network.");
        } else {
          setError(`Error: ${err.message}`);
        }
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchThemes();
  }, [guideId]);

  return { data, loading, error };
}