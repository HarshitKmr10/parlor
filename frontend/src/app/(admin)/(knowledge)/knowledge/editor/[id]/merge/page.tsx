'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { Flex } from '@radix-ui/themes';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Spinner from 'components/spinner/spinner';
import MergeView from 'components/dashboard/MergeView';
import { DashboardHeader } from 'components/dashboard/DashboardHeader';
import withAuth from 'components/withAuth';
import { useDashboard, useActionsForKB } from 'hooks/useDashboard';
import { VIEWS } from 'constants/dashboard';
import { useGlobalContext } from 'contexts/store';
import { apiService } from 'services/dashboard';

function MergePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const { selectedRecommendation, previousPath, setPreviousPath, setSelectedRecommendation } = useGlobalContext();
  const { isActionLoading } = useDashboard();
  const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);
  const hasFetchedRef = useRef(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout>();
  
  console.log('selectedRecommendation', selectedRecommendation);

  // If selectedRecommendation is not available but we have kb_ids in URL, fetch the recommendation
  useEffect(() => {
    const kbIdsParam = searchParams.get('kb_ids');
    const recommendationId = params?.id as string;
    
    if (!selectedRecommendation && kbIdsParam && recommendationId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      setIsLoadingFromUrl(true);
      const kbIds = kbIdsParam.split(',').filter(Boolean);
      
      // Reconstruct recommendation object and make API call
      const recommendation = {
        id: recommendationId,
        type: 'merge' as const,
        related_to_kb_ids: kbIds.map((id) => ({
          id,
          title: '',
          access_url: '',
          number: '',
        })),
        metadata: {},
      };
      
      apiService.handleRecommendationAction(recommendation)
        .then((result) => {
          setSelectedRecommendation(result);
          setIsLoadingFromUrl(false);
        })
        .catch((error) => {
          console.error('Failed to load recommendation from URL:', error);
          setIsLoadingFromUrl(false);
          hasFetchedRef.current = false; // Allow retry on error
          // Redirect to collections page if fetch fails
          router.back();
        });
    }
  }, [searchParams, params, selectedRecommendation, setSelectedRecommendation, router]);

  // Redirect to collections if data is not available after fetch attempt
  useEffect(() => {
    const kbIdsParam = searchParams.get('kb_ids');
    
    // Only redirect if:
    // 1. We're not currently loading anything
    // 2. We don't have selectedRecommendation
    // 3. We've already attempted to fetch (hasFetchedRef.current is true) OR there are no URL params to fetch from
    if (!isActionLoading && !isLoadingFromUrl && !selectedRecommendation) {
      const shouldRedirect = !kbIdsParam || hasFetchedRef.current;
      
      if (shouldRedirect) {
        redirectTimeoutRef.current = setTimeout(() => {
          console.log('No recommendation data available, redirecting to collections');
          router.back();
        }, 1000); // Wait 1 second to allow for any pending state updates
      }
    }

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [isActionLoading, isLoadingFromUrl, selectedRecommendation, searchParams, router]);

  // Prevent browser refresh - show warning dialog
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages and show their own
      e.returnValue = '';
      return '';
    };

    // Intercept keyboard shortcuts for refresh (F5, Ctrl+R, Ctrl+Shift+R, Cmd+R)
    const handleKeyDown = (e: KeyboardEvent) => {
      // F5 key
      if (e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      
      // Ctrl+R or Ctrl+Shift+R (Windows/Linux) or Cmd+R (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      
      // Ctrl+F5 (hard refresh)
      if (e.ctrlKey && e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase to intercept early

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);
  const {
    isLoadingForMerge,
    showSuccessDialogForMerge,
    setShowSuccessDialogForMerge,
    isEditingForMerge,
    setIsEditingForMerge,
    handleMergeAndSave: _handleMergeAndSave,
    handleCancelForMerge,
    enabledCompareForMerge,
    setEnabledCompareForMerge,
  } = useActionsForKB({
    onSetView: () => { }, // We'll handle navigation differently
  });

  const handleMergeAndSave = async () => {
    if (selectedRecommendation) {
      await _handleMergeAndSave(selectedRecommendation);
      setShowSuccessDialogForMerge(true);

      setTimeout(() => {
        setShowSuccessDialogForMerge(false);
        // router.push('/knowledge/dashboard');
        handleBack();
      }, 1500);
    }
  };

  const handleBack = () => {
    router.replace('/knowledge/collections?tab=deduplicated');
    setPreviousPath('');
  };

  const handleNavigateToLogs = () => {
    router.push('/knowledge/logs');
  };

  const handleNavigateToInventory = () => {
  };

  if (isActionLoading || isLoadingFromUrl || !selectedRecommendation) {
    return <Spinner />;
  }

  return (
    <Flex direction="column" className="h-full">
      <DashboardHeader
        view={VIEWS.MERGE}
        onBack={handleBack}
        onNavigateToLogs={handleNavigateToLogs}
        onNavigateToInventory={handleNavigateToInventory}
        isMergingKB={isLoadingForMerge}
        onMergeKB={() => handleMergeAndSave()}
        handleCancelForMerge={handleBack}
        currentArticle={selectedRecommendation}
        enabledCompareForMerge={enabledCompareForMerge}
        setEnabledCompareForMerge={setEnabledCompareForMerge}
        onUpload={() => { }}  // Not needed in merge view
      />
      <MergeView
        isLoadingForMerge={isLoadingForMerge}
        showSuccessDialogForMerge={showSuccessDialogForMerge}
        setShowSuccessDialogForMerge={setShowSuccessDialogForMerge}
        isEditingForMerge={isEditingForMerge}
        setIsEditingForMerge={setIsEditingForMerge}
        enabledCompareForMerge={enabledCompareForMerge}
      />
      <ToastContainer />
    </Flex>
  );
}

export default (MergePage);