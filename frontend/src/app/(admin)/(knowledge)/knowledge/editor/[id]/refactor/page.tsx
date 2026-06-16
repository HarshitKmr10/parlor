'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Flex } from '@radix-ui/themes';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Spinner from 'components/spinner/spinner';
import RefactorView from 'components/dashboard/RefactorView';
import { DashboardHeader } from 'components/dashboard/DashboardHeader';
import withAuth from 'components/withAuth';
import { useDashboard, useActionsForKB } from 'hooks/useDashboard';
import { VIEWS } from 'constants/dashboard';

function RefactorPage() {
  const router = useRouter();
  const { selectedRecommendation, isActionLoading } = useDashboard();
  const {
    isLoadingForRefactor,
    showSuccessDialogForRefactor,
    setShowSuccessDialogForRefactor,
    isEditingForRefactor,
    setIsEditingForRefactor,
    handleRefactorAndSave: _handleRefactorAndSave,
    handleCancelForRefactor,
    enabledCompareForRefactor,
    setEnabledCompareForRefactor,
    showImprovedContent,
    setShowImprovedContent,
  } = useActionsForKB({
    onSetView: () => {}, // We'll handle navigation differently
  });

  const handleRefactorAndSave = async () => {
    if (selectedRecommendation) {
      await _handleRefactorAndSave(selectedRecommendation);
      setShowSuccessDialogForRefactor(true);
      
      setTimeout(() => {
        setShowSuccessDialogForRefactor(false);
        router.push('/knowledge/dashboard');
      }, 1500);
    }
  };

  const handleBack = () => {
    router.push('/knowledge/dashboard');
  };

  const handleNavigateToLogs = () => {
    router.push('/knowledge/logs');
  };

  const handleNavigateToInventory = () => {
    router.push('/knowledge/collections');
  };

  if (isActionLoading || !selectedRecommendation) {
    return <Spinner />;
  }

  return (
    <Flex direction="column" className="h-full">
      <DashboardHeader
        view={VIEWS.REFACTOR}
        onBack={handleBack}
        onNavigateToLogs={handleNavigateToLogs}
        onNavigateToInventory={handleNavigateToInventory}
        isEditingForRefactor={isEditingForRefactor}
        handleRefactorAndSave={() => handleRefactorAndSave()}
        handleCancelForRefactor={handleCancelForRefactor}
        currentArticle={selectedRecommendation}
        enabledCompareForRefactor={enabledCompareForRefactor}
        setEnabledCompareForRefactor={setEnabledCompareForRefactor}
        showImprovedContent={showImprovedContent}
        onUpload={() => {}}  // Not needed in refactor view
      />
      <RefactorView
        recommendation={selectedRecommendation}
        isLoadingForRefactor={isLoadingForRefactor}
        showSuccessDialogForRefactor={showSuccessDialogForRefactor}
        setShowSuccessDialogForRefactor={setShowSuccessDialogForRefactor}
        isEditingForRefactor={isEditingForRefactor}
        setIsEditingForRefactor={setIsEditingForRefactor}
        enabledCompareForRefactor={enabledCompareForRefactor}
        showImprovedContent={showImprovedContent}
        setShowImprovedContent={setShowImprovedContent}
      />
      <ToastContainer />
    </Flex>
  );
}

export default (RefactorPage);