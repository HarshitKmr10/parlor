'use client';
import React, { useState } from 'react';
import { useGlobalContext } from '../../../contexts/store';

// Import components
import TrainAssistFilterBar from '../../../components/TrainAssistDashboard/TrainAssistFilterBar';
import TotalLearnersCard from '../../../components/TrainAssistDashboard/TotalLearnersCard';
import AverageQuizScoreCard from '../../../components/TrainAssistDashboard/AverageQuizScoreCard';
import AverageAttemptsToPassQuizCard from '../../../components/TrainAssistDashboard/SimulationCompletionCard';
import AverageOverallProgressCard from '../../../components/TrainAssistDashboard/AverageOverallProgressCard';
import DropOffRateCard from '../../../components/TrainAssistDashboard/DropOffRateCard';
import OverallProgressChart from '../../../components/TrainAssistDashboard/OverallProgressChart';
import CollectionsOverviewChart from '../../../components/TrainAssistDashboard/CollectionsOverviewChart';
import TopEmployeeProgressTable from '../../../components/TrainAssistDashboard/TopEmployeeProgressTable';
import ModulesPerformanceSummaryChart from '../../../components/TrainAssistDashboard/ModulesPerformanceSummaryChart';

// Import hooks
import { useTrainAssistMetrics } from '../../../hooks/train-assist/useTrainAssistMetrics';
import { useCollectionsData } from '../../../hooks/train-assist/useCollectionsData';
import { useModulesPerformanceData } from '../../../hooks/train-assist/useModulesPerformanceData';

const TrainAssistAnalyticsPage: React.FC = () => {
  const { user } = useGlobalContext();
  const [selectedTimePeriod, setSelectedTimePeriod] = useState('30 days');
  const [selectedDashboard, setSelectedDashboard] = useState('Train Assist Dashboard');

  // Fetch data using the new hook
  const { data: dashboardData, loading: dashboardLoading, error: dashboardError } = useTrainAssistMetrics(
    user?.org_id || '',
    
  );

  const { data: collectionsData, loading: collectionsLoading } = useCollectionsData({
    orgId: user?.org_id,
  });

  const { data: modulesData, loading: modulesLoading } = useModulesPerformanceData({
    timePeriod: selectedTimePeriod,
    orgId: user?.org_id,
  });

  const handleTimePeriodChange = (period: string) => {
    setSelectedTimePeriod(period);
  };

  const handleDashboardChange = (dashboard: string) => {
    setSelectedDashboard(dashboard);
  };

  // Calculate drop-off rate from progress funnel data
  const calculateDropOffRate = (data: any) => {
    if (!data?.progress_funnel) return null;
    const { topic_started, simulation_done } = data.progress_funnel;
    if (topic_started === 0) return 0;
    return ((topic_started - simulation_done) / topic_started) * 100;
  };

  // Show loading state
  const isLoading = dashboardLoading || collectionsLoading || modulesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Train Assist Dashboard...</p>
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading dashboard</p>
          <p className="text-gray-600">{dashboardError.message || 'Failed to load dashboard data'}</p>
          <div className="mt-4 space-x-2">
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Retry
            </button>
            <button 
              onClick={() => console.log('Dashboard Error Details:', dashboardError)} 
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              View Error Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Filter Bar */}
      <TrainAssistFilterBar
        onDashboardChange={handleDashboardChange}
        onTimePeriodChange={handleTimePeriodChange}
      />

      {/* Main Content */}
      <div className="p-6">
        {/* Top Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <TotalLearnersCard
            value={dashboardData?.total_learners || null}
            loading={dashboardLoading}
          />
          <AverageQuizScoreCard
            value={dashboardData?.average_quiz_score || null}
            loading={dashboardLoading}
          />
          <AverageAttemptsToPassQuizCard
            value={dashboardData?.average_attempts_before_pass || null}
            loading={dashboardLoading}
          />
          <AverageOverallProgressCard
            value={dashboardData?.average_overall_progress || null}
            loading={dashboardLoading}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Overall Progress */}
          <OverallProgressChart
            data={dashboardData?.progress_funnel || null}
            loading={dashboardLoading}
          />

          {/* Collections Overview */}
          <CollectionsOverviewChart
            data={collectionsData}
            loading={collectionsLoading}
          />
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Employee Progress */}
          <TopEmployeeProgressTable
            orgId={user?.org_id}
          />

          {/* Modules Performance Summary */}
          <ModulesPerformanceSummaryChart
            data={modulesData}
            loading={modulesLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default TrainAssistAnalyticsPage; 