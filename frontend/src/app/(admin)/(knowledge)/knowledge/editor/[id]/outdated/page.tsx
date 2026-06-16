'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Flex } from '@radix-ui/themes';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Spinner from 'components/spinner/spinner';
import  RefactorView  from 'components/dashboard/RefactorView';
import withAuth from 'components/withAuth';
import { useDashboard, useActionsForKB } from 'hooks/useDashboard';
import OutdatedView from 'components/dashboard/OutdatedView';

function RefactorPage() {
  const params = useParams();
  const { selectedRecommendation, isActionLoading, handleRecommendationAction } = useDashboard();
  const {
    isLoadingForRefactor,
    showSuccessDialogForRefactor,
    setShowSuccessDialogForRefactor,
    isEditingForRefactor,
    setIsEditingForRefactor,
    handleRefactorAndSave,
    handleCancelForRefactor,
    enabledCompareForRefactor,
    setEnabledCompareForRefactor,
    showImprovedContent,
    setShowImprovedContent,
  } = useActionsForKB({
    onSetView: () => {}, // We'll use router instead
  });

  useEffect(() => {
    if (selectedRecommendation) {
      handleRecommendationAction(selectedRecommendation);
    }
  }, [selectedRecommendation]);

  if (isActionLoading) {
    return <Spinner />;
  }

  return (
    <Flex direction="column" className="h-full">
      <OutdatedView
            recommendation={selectedRecommendation}
            isLoadingForRefactor={isLoadingForRefactor}
            isEditingForRefactor={isEditingForRefactor}
            setIsEditingForRefactor={setIsEditingForRefactor}
            showImprovedContent={showImprovedContent}
            setShowImprovedContent={setShowImprovedContent}
            showSuccessDialogForRefactor={showSuccessDialogForRefactor}
            setShowSuccessDialogForRefactor={setShowSuccessDialogForRefactor}
          />
      <ToastContainer />
    </Flex>
  );
}

export default (RefactorPage);