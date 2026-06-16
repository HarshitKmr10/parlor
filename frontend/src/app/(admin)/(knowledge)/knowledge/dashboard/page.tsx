'use client';

import React, { useCallback, useEffect } from 'react';
import { Flex } from '@radix-ui/themes';
import { useRouter } from 'next/navigation';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import 'react-toastify/dist/ReactToastify.css';

import Spinner from 'components/spinner/spinner';
import MergeView from 'components/dashboard/MergeView';
import RefactorView from 'components/dashboard/RefactorView';
import CreateKBView from 'components/dashboard/CreateKBView';
import UploadKBModal from 'components/dashboard/UploadKBModal';

import withAuth from 'components/withAuth';
import { VIEWS } from 'constants/dashboard';
import { DashboardHeader } from 'components/dashboard/DashboardHeader';
import { useUploadModal, useDashboard, useActionsForKB } from 'hooks/useDashboard';
import { DashboardView } from 'components/dashboard/DashboardView';
import OutdatedView from 'components/dashboard/OutdatedView';
import {
  getDashboardStats,
  getLowScoringArticles,
  getRecommendations,
  getCommonIssues,
  getKbQualityData,
} from './dashboardData';
import TranslateViewNew from 'components/dashboard/TranslateViewNew';
import { Recommendation } from 'types/dashboard';
import { useGlobalContext } from 'contexts/store';

function KnowledgeBaseDashboard() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const {
    dashboardData,
    commonIssuesData,
    isDashboardDataLoading,
    isCommonIssuesLoading,
    view,
    setView,
    selectedRecommendation,
    isActionLoading,
    fetchDashboardData,
    fetchCommonIssues,
    handleRecommendationAction,
  } = useDashboard();

  const {
    isLoadingForCreateKB,
    
    isLoadingForMerge,
    
    handleCancelForMerge,
    enabledCompareForMerge,
    setEnabledCompareForMerge,
    isEditingForRefactor,
    setIsEditingForRefactor,
    handleCancelForRefactor,

    showSuccessDialogForRefactor,
    setShowSuccessDialogForRefactor,
    isLoadingForRefactor,
    enabledCompareForRefactor,
    setEnabledCompareForRefactor,
    showImprovedContent,
    setShowImprovedContent,
    handleCancelForCreateKB,
    isLoadingForTranslate,
    
    handleCreateKB: _handleCreateKB,
    handleMergeAndSave: _handleMergeAndSave,
    handleRefactorAndSave: _handleRefactorAndSave,
    handleTranslateAndSave: _handleTranslateAndSave,
  } = useActionsForKB({ onSetView: setView });

  const { isUploadModalOpen, handleOpenUploadModal, handleCloseUploadModal } = useUploadModal();

  const fetchDashboardDataAndCommonIssues = useCallback(async () => {
    const data = await fetchDashboardData();
    if (data?.ticket_features_enabled !== false) {
      fetchCommonIssues();
    }
  }, [fetchDashboardData, fetchCommonIssues]);

  useEffect(() => {
    fetchDashboardDataAndCommonIssues();
  }, [fetchDashboardDataAndCommonIssues]);

  // Initialize i18n on component mount
  useEffect(() => {
    // Ensure i18n is ready before rendering
    if (!i18n.isInitialized) {
      i18n.init();
    }
  }, [i18n]);


  // refresh dashboard data after recommendation actions
  const handleCreateKB = useCallback(async (recommendation: Recommendation, collectionId: string) => {
    await _handleCreateKB(recommendation, collectionId);
    fetchDashboardDataAndCommonIssues();
  }, [_handleCreateKB, fetchDashboardDataAndCommonIssues]);

  const handleMergeAndSave = useCallback(async (recommendation: Recommendation) => {
    await _handleMergeAndSave(recommendation);
    fetchDashboardDataAndCommonIssues();
  }, [_handleMergeAndSave, fetchDashboardDataAndCommonIssues]);

  const handleRefactorAndSave = useCallback(async (recommendation: Recommendation) => {
    await _handleRefactorAndSave(recommendation);
    fetchDashboardDataAndCommonIssues();
  }, [_handleRefactorAndSave, fetchDashboardDataAndCommonIssues]);

  const handleTranslateAndSave = useCallback(async (recommendation: Recommendation) => {
    await _handleTranslateAndSave(recommendation);
    fetchDashboardDataAndCommonIssues();
  }, [_handleTranslateAndSave, fetchDashboardDataAndCommonIssues]);

  const handleUploadSuccess = () => {
    handleCloseUploadModal();
    fetchDashboardDataAndCommonIssues();
    // router.push('/knowledge/collections?tab=articles');
  };

  if (isActionLoading ) {
    return <Spinner />;
  }

  // if (error) {
  //   throw new Error(error);
  // }

  const dashboardStats = getDashboardStats(dashboardData);
  const lowScoringArticles = getLowScoringArticles(dashboardData);
  const recommendations = getRecommendations(dashboardData);
  const commonIssues = getCommonIssues(commonIssuesData);
  const kbQualityData = getKbQualityData(dashboardData);
  const ticketFeaturesEnabled = dashboardData?.ticket_features_enabled !== false;

  const renderView = () => {
    switch (view) {
      case VIEWS.DASHBOARD:
        return (
          <DashboardView
            dashboardStats={dashboardStats}
            commonIssues={commonIssues}
            lowScoringArticles={lowScoringArticles}
            kbQualityData={kbQualityData}
            recommendations={recommendations}
            onRecommendationAction={handleRecommendationAction}
            onCommonIssueAction={handleRecommendationAction}
            isDashboardDataLoading={isDashboardDataLoading}
            isCommonIssuesLoading={isCommonIssuesLoading}
            ticketFeaturesEnabled={ticketFeaturesEnabled}
          />
        );
      // case VIEWS.MERGE:
      //   return (
      //     <MergeView
      //       recommendation={selectedRecommendation}
      //       onSetView={setView}
      //       isLoadingForMerge={isLoadingForMerge}
      //       showSuccessDialogForMerge={showSuccessDialogForMerge}
      //       setShowSuccessDialogForMerge={setShowSuccessDialogForMerge}
      //       isEditingForMerge={isEditingForMerge}
      //       setIsEditingForMerge={setIsEditingForMerge}
      //       enabledCompareForMerge={enabledCompareForMerge}
      //     />
      //   );
      // case VIEWS.REFACTOR:
      //   return (
      //     <RefactorView
      //       recommendation={selectedRecommendation}
      //       onSetView={setView}
      //       isLoadingForRefactor={isLoadingForRefactor}
      //       showSuccessDialogForRefactor={showSuccessDialogForRefactor}
      //       setShowSuccessDialogForRefactor={setShowSuccessDialogForRefactor}
      //       isEditingForRefactor={isEditingForRefactor}
      //       setIsEditingForRefactor={setIsEditingForRefactor}
      //       enabledCompareForRefactor={enabledCompareForRefactor}
      //       showImprovedContent={showImprovedContent}
      //       setShowImprovedContent={setShowImprovedContent}
      //     />
      //   );
      // case VIEWS.CREATE_NEW_KB:
      //   return (
      //     <CreateKBView
      //       recommendation={selectedRecommendation}
      //       // onSetView={setView}
      //       isLoadingForCreateKB={isLoadingForCreateKB}
      //       showSuccessDialogForCreateKB={showSuccessDialogForCreateKB}
      //       setShowSuccessDialogForCreateKB={setShowSuccessDialogForCreateKB}
      //       isEditingForCreateKB={isEditingForCreateKB}
      //       setIsEditingForCreateKB={setIsEditingForCreateKB}
      //     />
      //   );
      case VIEWS.REFACTOR:
        return (
          <OutdatedView
            recommendation={selectedRecommendation}
            isLoadingForRefactor={isLoadingForRefactor}
            isEditingForRefactor={isEditingForRefactor}
            setIsEditingForRefactor={setIsEditingForRefactor}
            showImprovedContent={showImprovedContent}
            setShowImprovedContent={setShowImprovedContent}
            showSuccessDialogForRefactor={showSuccessDialogForRefactor}
            setShowSuccessDialogForRefactor={setShowSuccessDialogForRefactor}
            // onSetView={setView}
          />
        );
      // case VIEWS.MISSING_TRANSLATION:
      //   return (
      //     <TranslateViewNew
      //       recommendation={selectedRecommendation}
      //       onSetView={setView}
      //       isLoadingForTranslate={isLoadingForTranslate}
      //       showSuccessDialogForTranslate={showSuccessDialogForTranslate}
      //       setShowSuccessDialogForTranslate={setShowSuccessDialogForTranslate}
      //       isEditingForTranslate={isEditingForTranslate}
      //       setIsEditingForTranslate={setIsEditingForTranslate}
      //     />
      //   );
      default:
        return null;
    }
  };

  const currentArticle = selectedRecommendation || null;

  return (
    <Flex direction="column" className="h-full">
      <DashboardHeader
        view={view}
        onBack={() => setView(VIEWS.DASHBOARD)}
        onUpload={handleOpenUploadModal}
        onNavigateToLogs={() => router.push('/knowledge/logs')}
        onNavigateToInventory={() => router.push('/knowledge/collections')}
        totalArticles={dashboardData?.total_documents}
        onSubmitForApproval={() => {
          setView(VIEWS.DASHBOARD);
        }}
        isCreatingKB={isLoadingForCreateKB}
        onCreateKB={(collectionId: string) => handleCreateKB(selectedRecommendation, collectionId)}
        isMergingKB={isLoadingForMerge}
        onMergeKB={() => handleMergeAndSave(selectedRecommendation)}
        enabledCompareForMerge={enabledCompareForMerge}
        setEnabledCompareForMerge={setEnabledCompareForMerge}
        enabledCompareForRefactor={enabledCompareForRefactor}
        setEnabledCompareForRefactor={setEnabledCompareForRefactor}
        showImprovedContent={showImprovedContent}
        isEditingForRefactor={isEditingForRefactor}
        handleRefactorAndSave={() => handleRefactorAndSave(selectedRecommendation)}
        handleCancelForRefactor={handleCancelForRefactor}
        handleCancelForMerge={handleCancelForMerge}
        handleCancelForCreateKB={handleCancelForCreateKB}
        currentArticle={currentArticle}
        handleTranslateAndSave={() => handleTranslateAndSave(selectedRecommendation)}
        isTranslating={isLoadingForTranslate}
      />
      {renderView()}
      <UploadKBModal
        isOpen={isUploadModalOpen}
        onClose={handleCloseUploadModal}
        onUploadSuccess={handleUploadSuccess}
        onUploadComplete={(fileCount) => {
          router.push(`/knowledge/collections?uploadCount=${fileCount}`);
        }}
      />
      {!isUploadModalOpen && <ToastContainer />}
    </Flex>
  );
}

export default withAuth(KnowledgeBaseDashboard);
