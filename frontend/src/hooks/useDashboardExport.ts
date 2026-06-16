'use client';

import { useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type DashboardType = 'cva' | 'agent-assist';

interface UseDashboardExportProps {
  orgId: string;
  period?: string;
  format?: ExportFormat;
}

const MEDIA_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

const FILE_EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  xlsx: 'xlsx',
  pdf: 'pdf',
};

export const useDashboardExport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTimestamp = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');

    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  };

  const downloadDashboard = async (
    dashboardType: DashboardType,
    { orgId, period = '30days', format = 'xlsx' }: UseDashboardExportProps
  ) => {
    if (!orgId) {
      throw new Error('orgId is required');
    }

    setError(null);

    const params = new URLSearchParams({
      org_id: orgId,
      period,
      format,
    });

    // Determine the API endpoint based on dashboard type
    const endpoint = dashboardType === 'cva'
      ? `/analytics/v2/cva/export`
      : `/analytics/v3/export`;

    const url = `${endpoint}?${params.toString()}`;

    try {
      setLoading(true);

      const response = await serviceDeskInstance.get(url, {
        responseType: 'blob',
      });

      // Extract filename from content-disposition header or generate fallback
      const contentDisposition = response.headers['content-disposition'];
      const dashboardName = dashboardType === 'cva' ? 'cva_dashboard' : 'agent_assist_dashboard';
      const fallbackFilename = `${dashboardName}_${orgId}_${formatTimestamp()}.${FILE_EXTENSIONS[format]}`;

      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replaceAll('"', '') || fallbackFilename
        : fallbackFilename;

      const blob = new Blob([response.data], {
        type: MEDIA_TYPES[format],
      });

      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      window.URL.revokeObjectURL(link.href);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || `Failed to export ${dashboardType} dashboard`;
      console.error(`Failed to export ${dashboardType} dashboard:`, err);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const downloadCvaDashboard = async (props: UseDashboardExportProps) => {
    return downloadDashboard('cva', props);
  };

  const downloadAgentAssistDashboard = async (props: UseDashboardExportProps) => {
    return downloadDashboard('agent-assist', props);
  };

  return {
    downloadCvaDashboard,
    downloadAgentAssistDashboard,
    downloadDashboard,
    loading,
    error,
  };
};
