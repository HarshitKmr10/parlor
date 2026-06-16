// hooks/useDashboard.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import { useGlobalContext } from 'contexts/store';
import { apiService } from '../services/dashboard';
import { COLLECTION_ID, VIEWS } from '../constants/dashboard';
import {
  ViewType, Recommendation, Issue,
} from '../types/dashboard';
import { useRouter } from 'next/navigation';

export const useDashboard = () => {
  const { organization, user, setSelectedRecommendation, selectedRecommendation } = useGlobalContext();
  const [dashboardData, setDashboardData] = useState(null);
  const [commonIssuesData, setCommonIssuesData] = useState(null);
  const [isDashboardDataLoading, setIsDashboardDataLoading] = useState(false);
  const [isCommonIssuesLoading, setIsCommonIssuesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>(VIEWS.DASHBOARD);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const router = useRouter();
  const recommendationActionAbortControllerRef = useRef<AbortController | null>(null);
  const fetchDashboardData = useCallback(async () => {
    setIsDashboardDataLoading(true);
    try {
      const response = await apiService.fetchDashboardData();
      setDashboardData(response);
      if (response?.ticket_features_enabled === false) {
        setCommonIssuesData({ data: [] });
        setIsCommonIssuesLoading(false);
      }
      setError(null);
      return response;
    } catch (error) {
      setError(error.message);
      toast.error(error.message);
      return null;
    } finally {
      setIsDashboardDataLoading(false);
    }
  }, [user]);

  const fetchCommonIssues = useCallback(async () => {
    setIsCommonIssuesLoading(true);
    try {
      const data = await apiService.fetchCommonIssues(organization.id);
      setCommonIssuesData(data);
      setError(null);
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status === 403) {
        setCommonIssuesData({ data: [] });
      } else {
        setError((error as any)?.message);
        toast.error((error as any)?.message);
      }
    } finally {
      setIsCommonIssuesLoading(false);
    }
  }, [organization?.id, user]);

  const handleRecommendationAction = useCallback(async (recommendation: Recommendation, templateId?: number, signal?: AbortSignal) => {
    // Cancel any previous action if it exists
    if (recommendationActionAbortControllerRef.current) {
      recommendationActionAbortControllerRef.current.abort();
    }

    // Create new AbortController if signal not provided
    const abortController = signal ? null : new AbortController();
    const abortSignal = signal || abortController?.signal;
    
    if (abortController) {
      recommendationActionAbortControllerRef.current = abortController;
    }
    
    try {
      setIsActionLoading(true);
      if (recommendation.type === 'refactor') {
        router.push(`/knowledge/editor/edit-document?id=${recommendation.related_to_kb_ids[0].id}`);
        return;
      }
  
      const result = await apiService.handleRecommendationAction(
        recommendation,
        templateId,
        abortSignal
      );
      
      // Check if request was aborted before proceeding
      if (abortSignal?.aborted) {
        return;
      }
      
      setSelectedRecommendation(result);

      // Update paths to match the [id] folder structure
      const editorPaths = {
        'create_new_kb': `/knowledge/editor/${recommendation.id}/create`,
        'merge': `/knowledge/editor/${recommendation.id}/merge`,
        'refactor': `/knowledge/editor/${recommendation.id}/refactor`,
        'missing_translation': `/knowledge/editor/${recommendation.id}/translate`,
        'outdated': `/knowledge/editor/${recommendation.id}/outdated`,
      };

      const redirectPath = editorPaths[recommendation.type];
      if (redirectPath) {
        // Check again before navigation
        if (abortSignal?.aborted) {
          return;
        }
        await router.replace(redirectPath);
        return result;
      }
    } catch (error: any) {
      // Don't show error toast if request was aborted
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }
      toast.error(error.message);
    } finally {
      // Clear abort controller reference
      if (recommendationActionAbortControllerRef.current === abortController) {
        recommendationActionAbortControllerRef.current = null;
      }
      // setIsActionLoading(false);
    }
  }, [user, router]);

  const cancelRecommendationAction = useCallback(() => {
    if (recommendationActionAbortControllerRef.current) {
      recommendationActionAbortControllerRef.current.abort();
      recommendationActionAbortControllerRef.current = null;
    }
  }, []);

  const handleCommonIssueAction = useCallback(
    async (issue: Issue) => {
      setIsActionLoading(true);
      try {
        const result = await apiService.handleCommonIssueAction(
          issue
        );
        setSelectedIssue(result);
        setView(issue.type);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setIsActionLoading(false);
      }
    },
    [user],
  );

  return {
    dashboardData,
    commonIssuesData,
    isDashboardDataLoading: isDashboardDataLoading,
    isCommonIssuesLoading: isCommonIssuesLoading,
    error,
    view,
    setView,
    selectedRecommendation,
    setSelectedRecommendation,
    isActionLoading,
    fetchDashboardData,
    fetchCommonIssues,
    handleRecommendationAction,
    handleCommonIssueAction,
    cancelRecommendationAction,
  };
};

// hooks/useUploadModal.ts
export const useUploadModal = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleOpenUploadModal = useCallback(() => {
    setIsUploadModalOpen(true);
  }, []);

  const handleCloseUploadModal = useCallback(() => {
    setIsUploadModalOpen(false);
  }, []);

  return {
    isUploadModalOpen,
    handleOpenUploadModal,
    handleCloseUploadModal,
  };
};

// hooks/useActionsForKB.ts
export const useActionsForKB = ({ onSetView }: { onSetView: (view: ViewType) => void }) => {
  const [isLoadingForCreateKB, setIsLoadingForCreateKB] = useState(false);
  const { user } = useGlobalContext();
  const [showSuccessDialogForCreateKB, setShowSuccessDialogForCreateKB] = useState(false);
  const [isEditingForCreateKB, setIsEditingForCreateKB] = useState(false);
  const [showSuccessDialogForMerge, setShowSuccessDialogForMerge] = useState(false);
  const [isLoadingForMerge, setIsLoadingForMerge] = useState(false);
  const [isEditingForMerge, setIsEditingForMerge] = useState(false);
  const [enabledCompareForMerge, setEnabledCompareForMerge] = useState(false);
  const [enabledCompareForRefactor, setEnabledCompareForRefactor] = useState(false);
  const [showSuccessDialogForRefactor, setShowSuccessDialogForRefactor] = useState(false);
  const [isLoadingForRefactor, setIsLoadingForRefactor] = useState(false);
  const [isEditingForRefactor, setIsEditingForRefactor] = useState(false);
  const [showImprovedContent, setShowImprovedContent] = useState(false);
  const [isLoadingForTranslate, setIsLoadingForTranslate] = useState(false);
  const [isEditingForTranslate, setIsEditingForTranslate] = useState(false);
  const [showSuccessDialogForTranslate, setShowSuccessDialogForTranslate] = useState(false);

  const handleCreateKB = useCallback(
    async (recommendation: Recommendation, collectionId: string) => {
      if (!user?.org_id) {
        toast.error('Organization ID is required');
        return;
      }

      setIsLoadingForCreateKB(true);

      try {
        const payload = {
          org_id: user?.org_id,
          knowledgebase_collection_id: collectionId,
          documents: [],
          title: recommendation.title,
          content: recommendation.content,
          resolve_recommendation_id: recommendation.id,
        };
        await apiService.createKB(payload, user);
        setShowSuccessDialogForCreateKB(true);
        toast.success('KB Article created successfully!');
      } catch (error) {
        toast.error(error.message);
        setShowSuccessDialogForCreateKB(false);
      }
    },
    [user?.org_id],
  );

  const handleCancelForCreateKB = useCallback(() => {
    if (isEditingForCreateKB && !window.confirm('Discard changes?')) {
      return;
    }
    onSetView(VIEWS.DASHBOARD);
  }, [onSetView, isEditingForCreateKB]);

  const handleMergeAndSave = useCallback(
    async (recommendation: Recommendation) => {
      setIsLoadingForMerge(true);
      try {
        const payload = {
          org_id: user?.org_id,
          knowledgebase_collection_id: COLLECTION_ID,
          documents: recommendation.kb_data.map((article) => article.id),
          title: recommendation.title || 'Test',
          content: recommendation.content,
          resolve_recommendation_id: recommendation.id,
        };

        await apiService.mergeAndSave(payload, user);
        setShowSuccessDialogForMerge(true);
        toast.success('Articles merged successfully!');
      } catch (error) {
        toast.error(error.message);
        setShowSuccessDialogForMerge(false);
      } finally {
        setIsLoadingForMerge(false);
      }
    },
    [user?.org_id],
  );

  const handleTranslateAndSave = useCallback(
    async (recommendation: Recommendation) => {
      setIsLoadingForTranslate(true);
      try {
        const payload = {
          title: recommendation.title || 'Test',
          content: recommendation.content,
          resolve_recommendation_id: recommendation.id,
        };


        await apiService.translateAndSaveNew(payload, user);
        setShowSuccessDialogForTranslate(true);
        toast.success('Articles translated successfully!');
      } catch (error) {
        toast.error(error.message);
        setShowSuccessDialogForTranslate(false);
      } finally {
        setIsLoadingForTranslate(false);
      }
    },
    [user?.org_id],
  );

  const handleCancelForMerge = useCallback(() => {
    if (isEditingForMerge && !window.confirm('Discard changes?')) {
      return;
    }
    onSetView(VIEWS.DASHBOARD);
  }, [onSetView, isEditingForMerge]);

  const handleCancelForRefactor = useCallback(() => {
    if (isEditingForRefactor && !window.confirm('Discard changes?')) {
      return;
    }
    onSetView(VIEWS.DASHBOARD);
  }, [onSetView, isEditingForRefactor]);

  const handleRefactorAndSave = useCallback(
    async (recommendation: Recommendation) => {
      setIsLoadingForRefactor(true);
      try {
        const payload = {
          org_id: user?.org_id,
          knowledgebase_collection_id: COLLECTION_ID,
          documents: recommendation.kb_data.map((article) => article.id),
          title: recommendation.title,
          content: recommendation.content,
          resolve_recommendation_id: recommendation.id,
        };

        await apiService.refactorAndSave(payload, user);
        setShowSuccessDialogForRefactor(true);
        toast.success('Changes saved successfully!');
      } catch (error) {
        throw new Error(error);
      } finally {
        setIsLoadingForRefactor(false);
      }
    },
    [user?.org_id],
  );

  return {
    isLoadingForCreateKB,
    showSuccessDialogForCreateKB,
    setShowSuccessDialogForCreateKB,
    handleCreateKB,
    isEditingForCreateKB,
    setIsEditingForCreateKB,
    isLoadingForMerge,
    showSuccessDialogForMerge,
    setShowSuccessDialogForMerge,
    handleMergeAndSave,
    isEditingForMerge,
    setIsEditingForMerge,
    handleCancelForMerge,
    enabledCompareForMerge,
    setEnabledCompareForMerge,
    isEditingForRefactor,
    setIsEditingForRefactor,
    handleCancelForRefactor,
    handleRefactorAndSave,
    showSuccessDialogForRefactor,
    setShowSuccessDialogForRefactor,
    isLoadingForRefactor,
    enabledCompareForRefactor,
    setEnabledCompareForRefactor,
    showImprovedContent,
    setShowImprovedContent,
    handleCancelForCreateKB,
    isLoadingForTranslate,
    isEditingForTranslate,
    showSuccessDialogForTranslate,
    setShowSuccessDialogForTranslate,
    setIsEditingForTranslate,
    handleTranslateAndSave,
  };
};
