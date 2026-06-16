'use client';

import { useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

interface UseTrainAssistExportProps {
  orgId: string;
  period?: string;
  tagId?: string;
}

export const useTrainAssistExport = () => {
  const [loading, setLoading] = useState(false);

  const formatTimestamp = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');

    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1); // getMonth() is zero-based
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  };

  const downloadTrainAssistMetrics = async ({ orgId, period, tagId }: UseTrainAssistExportProps) => {
    if (!orgId) throw new Error("orgId is required");


    const params = new URLSearchParams({ org_id: orgId });
    if (period) params.append("period", period);
    if (tagId) params?.append("tag_id", tagId === "all" ? "" : tagId);

    const url = `/analytics/train-assist-metrics-export?${params.toString()}`;

    try {
      setLoading(true);

      const response = await serviceDeskInstance.get(url, {
        responseType: 'blob',
      });

      // Extract filename or fallback to generated one
      const contentDisposition = response.headers['content-disposition'];
      const fallbackFilename = `train_assist_${orgId}_${formatTimestamp()}.xlsx`;

      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replaceAll('"', '') || fallbackFilename
        : fallbackFilename;

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("❌ Failed to export train assist metrics:", err);
      throw new Error('Failed to export train assist metrics');
    } finally {
      setLoading(false);
    }
  };

  return {
    downloadTrainAssistMetrics,
    loading,
  };
};