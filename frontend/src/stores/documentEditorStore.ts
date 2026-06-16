'use client';

import { create } from 'zustand';
import { toast } from 'react-toastify';
import { marked } from 'marked';
import { aiAgentInstance } from 'api/common/axiosInstance';
import { PostcallTopics } from 'api/postcallTopcs';
import { apiService } from 'services/dashboard';

interface DocumentEditorState {
  // Document data
  recommendationData: any | null;
  content: string;
  collectionSource: string | null;
  
  // UI states
  isLoading: boolean;
  isSaving: boolean;
  isDownloading: boolean;
  isApplying: boolean;
  isChangingTemplate: boolean;
  isEditingDocument: boolean;
  appliedImprovements: boolean;
  
  // Templates
  templates: any[];
  selectedTemplateId: number | null;
  isLoadingTemplates: boolean;
  
  // Links
  invalidLinks: any[];
  linkSuggestions: any[];
  isLinkModalOpen: boolean;
  currentLinkToReplace: string | null;
  newLink: string;
  
  // Version history
  isVersionHistoryOpen: boolean;
  
  // Compare view toggle
  isCompareView: boolean;
  
  // Editor key for forcing re-renders
  editorKey: number;
  
  // Default template snapshot (stored as object since refs don't work well in Zustand)
  defaultTemplateSnapshot: {
    content: string;
    appliedImprovements: boolean;
    isEditingDocument: boolean;
  } | null;
  
  // Document fetching
  hasFetchedDocumentId: string | null;
  
  // Precomputed diff content
  precomputedDiffContent: string | null;
  isFetchingDiff: boolean;
  
  // Full document data fetching
  isFetchingFullData: boolean;
  
  // Actions - Setters
  setRecommendationData: (data: any | null) => void;
  setContent: (content: string) => void;
  setCollectionSource: (source: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setIsDownloading: (downloading: boolean) => void;
  setIsApplying: (applying: boolean) => void;
  setIsChangingTemplate: (changing: boolean) => void;
  setIsEditingDocument: (editing: boolean) => void;
  setAppliedImprovements: (applied: boolean) => void;
  setTemplates: (templates: any[]) => void;
  setSelectedTemplateId: (id: number | null) => void;
  setIsLoadingTemplates: (loading: boolean) => void;
  setInvalidLinks: (links: any[]) => void;
  setLinkSuggestions: (suggestions: any[]) => void;
  setIsLinkModalOpen: (open: boolean) => void;
  setCurrentLinkToReplace: (url: string | null) => void;
  setNewLink: (link: string) => void;
  setIsVersionHistoryOpen: (open: boolean) => void;
  setIsCompareView: (isCompare: boolean) => void;
  updateEditorKey: () => void;
  setDefaultTemplateSnapshot: (snapshot: { content: string; appliedImprovements: boolean; isEditingDocument: boolean } | null) => void;
  setPrecomputedDiffContent: (content: string | null) => void;
  setIsFetchingDiff: (fetching: boolean) => void;
  setIsFetchingFullData: (fetching: boolean) => void;
  
  // Actions - Business Logic
  handleContentChange: (newContent: string) => void;
  backToOriginal: () => void;
  handleApplyAll: (t: any) => Promise<void>;
  handleTemplateChange: (templateId: string, t: any) => Promise<void>;
  handleSave: (documentId: string | null, router: any, t: any) => Promise<void>;
  handleDownload: (user: any, t: any) => Promise<void>;
  handleReplaceLink: () => void;
  handleFixLink: (suggestion: any) => void;
  handleDismissLink: (suggestionId: string) => void;
  handleInvalidLinkClick: (link: any) => void;
  handleVersionRestore: (newContent: string) => void;
  
  // Document fetching
  fetchDocument: (documentId: string, t: any) => Promise<void>;
  fetchFullDocumentData: (documentId: string, t: any) => Promise<void>;
  prefetchDiffContent: (originalContent: string, refactoredContent: string) => Promise<void>;
  processSuggestions: () => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  recommendationData: null,
  content: '',
  collectionSource: null,
  isLoading: true,
  isSaving: false,
  isDownloading: false,
  isApplying: false,
  isChangingTemplate: false,
  isEditingDocument: false,
  appliedImprovements: false,
  templates: [],
  selectedTemplateId: null,
  isLoadingTemplates: false,
  invalidLinks: [],
  linkSuggestions: [],
  isLinkModalOpen: false,
  currentLinkToReplace: null,
  newLink: '',
  isVersionHistoryOpen: false,
  isCompareView: false,
  editorKey: 0,
  defaultTemplateSnapshot: null,
  hasFetchedDocumentId: null,
  precomputedDiffContent: null,
  isFetchingDiff: false,
  isFetchingFullData: false,
};

export const useDocumentEditorStore = create<DocumentEditorState>((set, get) => ({
  ...initialState,
  
  // Setters
  setRecommendationData: (data) => set({ recommendationData: data }),
  setContent: (content) => set({ content }),
  setCollectionSource: (source) => set({ collectionSource: source }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsSaving: (saving) => set({ isSaving: saving }),
  setIsDownloading: (downloading) => set({ isDownloading: downloading }),
  setIsApplying: (applying) => set({ isApplying: applying }),
  setIsChangingTemplate: (changing) => set({ isChangingTemplate: changing }),
  setIsEditingDocument: (editing) => set({ isEditingDocument: editing }),
  setAppliedImprovements: (applied) => set({ appliedImprovements: applied }),
  setTemplates: (templates) => set({ templates }),
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
  setIsLoadingTemplates: (loading) => set({ isLoadingTemplates: loading }),
  setInvalidLinks: (links) => set({ invalidLinks: links }),
  setLinkSuggestions: (suggestions) => set({ linkSuggestions: suggestions }),
  setIsLinkModalOpen: (open) => set({ isLinkModalOpen: open }),
  setCurrentLinkToReplace: (url) => set({ currentLinkToReplace: url }),
  setNewLink: (link) => set({ newLink: link }),
  setIsVersionHistoryOpen: (open) => set({ isVersionHistoryOpen: open }),
  setIsCompareView: (isCompare) => set({ isCompareView: isCompare }),
  updateEditorKey: () => set((state) => ({ editorKey: state.editorKey + 1 })),
  setDefaultTemplateSnapshot: (snapshot) => set({ defaultTemplateSnapshot: snapshot }),
  setPrecomputedDiffContent: (content) => set({ precomputedDiffContent: content }),
  setIsFetchingDiff: (fetching) => set({ isFetchingDiff: fetching }),
  setIsFetchingFullData: (fetching) => set({ isFetchingFullData: fetching }),

  // Handle content change
  handleContentChange: (newContent: string) => {
    const state = get();
    const currentContentLength = state.content?.length || 0;
    const newContentLength = newContent?.length || 0;
    
    // Guard: Prevent suspiciously small content from overwriting large content
    // This is a safety net in case the TipTap guard doesn't catch it
    if (currentContentLength > 1000 && newContentLength < currentContentLength * 0.1) {
      console.warn('[Store] handleContentChange - IGNORED (suspicious size)', {
        currentContentLength,
        newContentLength,
        ratio: (newContentLength / currentContentLength * 100).toFixed(2) + '%',
        reason: 'new content is suspiciously small compared to current content'
      });
      return;
    }
    
    set({ content: newContent });
  },

  // Back to original
  backToOriginal: () => {
    const state = get();
    const originalContent = state.recommendationData?.document.content || '';
    if (originalContent) {
      set({
        content: originalContent,
        editorKey: state.editorKey + 1,
        appliedImprovements: false,
        isEditingDocument: false,
        selectedTemplateId: null,
      });
    }
  },

  // Apply all improvements
  handleApplyAll: async (t: (key: string) => string) => {
    const state = get();
    
    // Prevent multiple simultaneous calls
    if (state.isApplying) {
      console.warn('handleApplyAll already in progress');
      return;
    }
    
    if (state.appliedImprovements) {
      // Restore original content
      const originalContent = state.recommendationData?.document.content || '';
      if (originalContent) {
        set({
          content: originalContent,
          editorKey: state.editorKey + 1,
          appliedImprovements: false,
          selectedTemplateId: null,
        });
      }
    } else {
      if (state.recommendationData?.refactored_content && state.recommendationData?.document.content) {
        try {
          // Check if diff is already precomputed
          if (state.precomputedDiffContent) {
            // Use precomputed diff - no loader needed
            set({
              content: state.precomputedDiffContent,
              editorKey: state.editorKey + 1,
              appliedImprovements: true,
              isEditingDocument: true,
              isApplying: false,
            });
            return;
          }

          // Diff not precomputed yet - fetch it now (show loader)
          set({ isApplying: true });

          const response = await aiAgentInstance.post('/api/v1/knowledgeassist/compare_documents', {
            original_article: state.recommendationData.document.content,
            updated_article: state.recommendationData.refactored_content,
          });

          const diffContent = response.data?.data?.highlighted_content ?? '';

          if (!diffContent || typeof diffContent !== 'string') {
            console.error('Invalid diff content from API');
            set({ isApplying: false });
            toast.error(t('knowledge_assist.failedToApplyAIImprovements'));
            return;
          }

          // Parse markdown
          const diffHtml = await new Promise<string>((resolve) => {
            setTimeout(() => {
              try {
                const parsed = marked.parse(diffContent);
                resolve(parsed);
              } catch (error) {
                console.error('Error parsing markdown:', error);
                resolve(diffContent); // Fallback to raw content
              }
            }, 0);
          });
          
          set({
            content: diffHtml,
            editorKey: state.editorKey + 1,
            appliedImprovements: true,
            isEditingDocument: true,
            isApplying: false,
          });
        } catch (error) {
          console.error('Error comparing documents:', error);
          set({ isApplying: false });
          toast.error(t('knowledge_assist.failedToApplyAIImprovements'));
        }
      } else {
        set({ isApplying: false });
      }
    }
  },

  // Template change
  handleTemplateChange: async (templateId: string, t: (key: string, defaultValue?: string) => string) => {
    const state = get();
    if (!templateId || templateId === 'no-templates') return;

    if (templateId === 'default-template') {
      const snapshot = state.defaultTemplateSnapshot;
      if (snapshot) {
        set({
          content: snapshot.content,
          appliedImprovements: snapshot.appliedImprovements,
          isEditingDocument: true, // Always enable editing when switching back to default template
          editorKey: state.editorKey + 1,
          selectedTemplateId: null,
        });
      } else {
        state.backToOriginal();
        set({ 
          selectedTemplateId: null,
          isEditingDocument: true, // Enable editing when switching back to default template
        });
      }
      return;
    }

    const templateIdInt = parseInt(templateId, 10);
    const previousTemplateId = state.selectedTemplateId;

    set({
      selectedTemplateId: templateIdInt,
      isChangingTemplate: true,
      isEditingDocument: true,
    });

    try {
      const result = await apiService.convertTemplate(state.content, templateIdInt);
      if (result?.content) {
        set({
          content: result.content,
          editorKey: state.editorKey + 1,
          appliedImprovements: false,
        });
      }
    } catch (error) {
      console.error('Error changing template:', error);
      set({ selectedTemplateId: previousTemplateId });
      toast.error(t('knowledge_assist.failedToApplyTemplate', 'Failed to apply template'));
    } finally {
      set({ isChangingTemplate: false });
    }
  },

  // Save document
  handleSave: async (documentId: string | null, router: any, t: (key: string) => string) => {
    const state = get();
    set({ isSaving: true });
    
    try {
      let updatedSuggestions = [];
      if (state.recommendationData?.document?.suggestions) {
        try {
          const parsedSuggestions = JSON.parse(state.recommendationData.document.suggestions);
          const activeSuggestionIds = new Set(state.linkSuggestions.map((s) => s.id));

          updatedSuggestions = parsedSuggestions.filter((suggestion: any) => {
            if (suggestion.category === 'link_quality') {
              return activeSuggestionIds.has(suggestion.id);
            }
            if (suggestion.type === 'link') {
              const matchingLink = state.invalidLinks.find((link) => link.url === suggestion.url);
              return matchingLink && !matchingLink.resolved;
            }
            return true;
          });
        } catch (error) {
          console.error('Error parsing existing suggestions:', error);
        }
      }

      const contentToSave = state.content;
      let cleanContent = contentToSave.replace(/<mark[^>]*>(.*?)<\/mark>/g, '$1');

      cleanContent = cleanContent.replace(/<img([^>]*?)>/g, (match, attributes) => {
        const widthAttr = attributes.match(/width="(\d+)"/);
        const heightAttr = attributes.match(/height="(\d+)"/);
        const styleMatch = attributes.match(/style="([^"]*?)"/);
        const existingStyle = styleMatch ? styleMatch[1] : '';
        const styleWidthMatch = existingStyle.match(/width:\s*(\d+)px/);
        const styleHeightMatch = existingStyle.match(/height:\s*(\d+)px/);

        const width = styleWidthMatch ? styleWidthMatch[1] : widthAttr ? widthAttr[1] : null;
        const height = styleHeightMatch ? styleHeightMatch[1] : heightAttr ? heightAttr[1] : null;

        if (width || height) {
          let newStyle = existingStyle;
          newStyle = newStyle.replace(/width:\s*[^;]+;?/g, '').replace(/height:\s*[^;]+;?/g, '');
          if (width) newStyle += `width: ${width}px; `;
          if (height) newStyle += `height: ${height}px; `;
          newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^\s*;\s*/, '').replace(/\s*;\s*$/, '');

          const cleanAttributes = attributes
            .replace(/style="[^"]*?"/g, '')
            .replace(/width="[^"]*?"/g, '')
            .replace(/height="[^"]*?"/g, '')
            .trim();

          return `<img${cleanAttributes ? ' ' + cleanAttributes : ''} style="${newStyle}">`;
        }
        return match;
      });

      const currentScore =
        state.appliedImprovements && state.recommendationData?.statistics
          ? state.recommendationData.statistics.score
          : state.recommendationData?.document?.score || 0;

      const response = await aiAgentInstance.put('/api/v1/knowledgeassist/update_document', {
        id: documentId,
        name: state.recommendationData?.title || '',
        suggestions: JSON.stringify(updatedSuggestions),
        content: cleanContent,
        score: currentScore,
      });

      if (response.status !== 200) {
        throw new Error(t('knowledge_assist.failedToSaveDocument'));
      }

      toast.success(t('knowledge_assist.documentSavedSuccessfully'));
      setTimeout(() => {
        router.replace('/knowledge/collections');
      }, 5000);
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error(t('knowledge_assist.failedToSaveDocument'));
    } finally {
      set({ isSaving: false });
    }
  },

  // Download
  handleDownload: async (user: any, t: (key: string) => string) => {
    const state = get();
    set({ isDownloading: true });
    try {
      const contentToDownload = state.content;
      let cleanContent = contentToDownload.replace(/<mark[^>]*>(.*?)<\/mark>/g, '$1');

      cleanContent = cleanContent.replace(/<img([^>]*?)>/g, (match, attributes) => {
        const widthAttr = attributes.match(/width="(\d+)"/);
        const heightAttr = attributes.match(/height="(\d+)"/);
        const styleMatch = attributes.match(/style="([^"]*?)"/);
        const existingStyle = styleMatch ? styleMatch[1] : '';
        const styleWidthMatch = existingStyle.match(/width:\s*(\d+)px/);
        const styleHeightMatch = existingStyle.match(/height:\s*(\d+)px/);

        const width = styleWidthMatch ? styleWidthMatch[1] : widthAttr ? widthAttr[1] : null;
        const height = styleHeightMatch ? styleHeightMatch[1] : heightAttr ? heightAttr[1] : null;

        if (width || height) {
          let newStyle = existingStyle;
          newStyle = newStyle.replace(/width:\s*[^;]+;?/g, '').replace(/height:\s*[^;]+;?/g, '');
          if (width) newStyle += `width: ${width}px; `;
          if (height) newStyle += `height: ${height}px; `;
          newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^\s*;\s*/, '').replace(/\s*;\s*$/, '');

          const cleanAttributes = attributes
            .replace(/style="[^"]*?"/g, '')
            .replace(/width="[^"]*?"/g, '')
            .replace(/height="[^"]*?"/g, '')
            .trim();

          return `<img${cleanAttributes ? ' ' + cleanAttributes : ''} style="${newStyle}">`;
        }
        return match;
      });

      const pdfBlob = await PostcallTopics.convertMarkdownToPdfDocxZip(
        cleanContent,
        user,
        state.recommendationData?.document?.id,
        state.recommendationData?.document?.name,
      );

      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = state.recommendationData?.document?.name && `${state.recommendationData.document.name}.zip`;
      link.download = fileName || 'document.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(t('knowledge_assist.failedToGeneratePDF'));
    } finally {
      set({ isDownloading: false });
    }
  },

  // Link handlers
  handleReplaceLink: () => {
    const state = get();
    if (state.currentLinkToReplace && state.newLink) {
      const updatedContent = state.content.replace(state.currentLinkToReplace, state.newLink);
      set({
        content: updatedContent,
        invalidLinks: state.invalidLinks.map((link) =>
          link.url === state.currentLinkToReplace ? { ...link, resolved: true } : link,
        ),
        linkSuggestions: state.linkSuggestions.filter((s) => s.details.url !== state.currentLinkToReplace),
        isLinkModalOpen: false,
        newLink: '',
        currentLinkToReplace: null,
        editorKey: state.editorKey + 1,
      });
      toast.success('Link replaced successfully');
    }
  },

  handleFixLink: (suggestion: any) => {
    set({
      currentLinkToReplace: suggestion.details.url,
      isLinkModalOpen: true,
    });
  },

  handleDismissLink: (suggestionId: string) => {
    const state = get();
    set({
      linkSuggestions: state.linkSuggestions.filter((s) => s.id !== suggestionId),
    });
    toast.success('Suggestion dismissed');
  },

  handleInvalidLinkClick: (link: any) => {
    set({
      currentLinkToReplace: link.url,
      isLinkModalOpen: true,
    });
  },

  handleVersionRestore: (newContent: string) => {
    const state = get();
    set({
      content: newContent,
      editorKey: state.editorKey + 1,
    });
  },

  // Process suggestions from recommendationData
  processSuggestions: () => {
    const state = get();
    if (state.recommendationData?.document?.suggestions) {
      try {
        const parsedSuggestions = JSON.parse(state.recommendationData.document.suggestions);
        
        // Filter link quality suggestions
        const linkQualitySuggestions = parsedSuggestions.filter(
          (s: any) =>
            s.category === 'link_quality' && ['broken_link', 'insecure_link'].includes(s.type),
        );
        
        // Filter old format links
        const oldFormatLinks = parsedSuggestions
          .filter((suggestion: any) => suggestion.type === 'link')
          .map((suggestion: any) => ({
            url: suggestion.url,
            description: suggestion.reason,
            resolved: false,
          }));
        
        set({
          linkSuggestions: linkQualitySuggestions,
          invalidLinks: oldFormatLinks,
        });
      } catch (error) {
        console.error('Error parsing suggestions:', error);
        set({
          linkSuggestions: [],
          invalidLinks: [],
        });
      }
    }
  },

  // Fetch initial document content (fast, lightweight)
  fetchDocument: async (documentId: string, t: any) => {
    const state = get();
    
    // Skip if already fetched this document or no documentId
    if (!documentId || state.hasFetchedDocumentId === documentId) {
      return;
    }

    try {
      set({
        isLoading: true,
        recommendationData: null, // Clear old data to prevent stale title from previous document
        content: '', // Clear old content
        precomputedDiffContent: null, // Clear old diff when fetching new document
        isFetchingDiff: false,
        isFetchingFullData: false,
      });
      
      // First, fetch lightweight endpoint to get original content quickly
      const initialResponse = await aiAgentInstance.get(
        `/api/v1/knowledgeassist/document/${documentId}`,
      );
      
      if (initialResponse.status !== 200) {
        throw new Error(t('knowledge_assist.failedToFetchDocument'));
      }
      
      const initialData = initialResponse.data;
      const initialContent = initialData.document?.content || '';
      const initialTitle = initialData.title || initialData.document?.name || '';

      // Set initial content and basic document info - this unblocks the UI
      // Also set recommendationData with title to avoid "Untitled Document" flash
      // Set isFetchingFullData: true so skeleton shows while full data loads
      set({
        content: initialContent,
        collectionSource: initialData.document?.kb_collection?.source || null,
        recommendationData: {
          title: initialTitle,
          document: initialData.document,
        },
        hasFetchedDocumentId: documentId,
        defaultTemplateSnapshot: {
          content: initialContent,
          appliedImprovements: false,
          isEditingDocument: false,
        },
        isLoading: false, // UI is now unblocked
        isFetchingFullData: true, // Signal that full data is still loading
      });
      
      // Now fetch full document data in the background (non-blocking)
      get().fetchFullDocumentData(documentId, t);
      
    } catch (error) {
      console.error('Error fetching initial document:', error);
      set({ isLoading: false });
    }
  },

  // Fetch full document data (recommendations, refactored content, etc.) in background
  fetchFullDocumentData: async (documentId: string, t: any) => {
    // Skip if no documentId
    if (!documentId) {
      return;
    }

    try {
      // isFetchingFullData is already set to true by fetchDocument
      
      const response = await aiAgentInstance.get(
        `/api/v1/knowledgeassist/get_document_by_id/${documentId}`,
      );
      
      if (response.status !== 200) {
        throw new Error(t('knowledge_assist.failedToFetchDocument'));
      }
      
      const data = response.data;
      
      // Update with full document data
      // Note: content is already set from initial fetch, so we don't update it here
      // to preserve any user edits that might have occurred while this was loading
      
      // Preserve current template selection if user has already selected one
      // Get the current state right before setting to avoid race conditions where
      // user selects a template while fetchFullDocumentData is running
      const currentState = get();
      const currentTemplateId = currentState.selectedTemplateId;
      const apiTemplateId = data.document?.selected_template_id ?? null;
      
      // Always preserve user's template selection if one exists
      // Only initialize from API if no template is currently selected
      const templateIdToSet = currentTemplateId !== null 
        ? currentTemplateId  // User has selected a template - always preserve it
        : apiTemplateId;      // No template selected - initialize from API (or null if API has none)
      
      set({
        recommendationData: data,
        selectedTemplateId: templateIdToSet,
        isFetchingFullData: false,
      });
      
      // Pre-fetch diff content if we have both original and refactored content
      if (data.refactored_content && data.document.content) {
        // Fetch diff in background without blocking UI
        get().prefetchDiffContent(data.document.content, data.refactored_content);
      }
      
      // Process suggestions - will be handled by useEffect in component
      // This prevents duplicate processing and infinite loops
      
    } catch (error) {
      console.error('Error fetching full document data:', error);
      set({ isFetchingFullData: false });
    }
  },

  // Pre-fetch diff content in background
  prefetchDiffContent: async (originalContent: string, refactoredContent: string) => {
    const state = get();
    
    // Skip if already fetched or currently fetching
    if (state.precomputedDiffContent || state.isFetchingDiff) {
      return;
    }

    try {
      set({ isFetchingDiff: true });

      const response = await aiAgentInstance.post('/api/v1/knowledgeassist/compare_documents', {
        original_article: originalContent,
        updated_article: refactoredContent,
      });

      const diffContent = response.data?.data?.highlighted_content ?? '';

      if (!diffContent || typeof diffContent !== 'string') {
        console.error('Invalid diff content from API');
        set({ isFetchingDiff: false });
        return;
      }

      // Parse markdown asynchronously
      const diffHtml = await new Promise<string>((resolve) => {
        setTimeout(() => {
          try {
            const parsed = marked.parse(diffContent);
            resolve(parsed);
          } catch (error) {
            console.error('Error parsing markdown:', error);
            resolve(diffContent); // Fallback to raw content
          }
        }, 0);
      });
      
      // Store precomputed diff content (don't update editor content yet)
      set({
        precomputedDiffContent: diffHtml,
        isFetchingDiff: false,
      });
    } catch (error) {
      console.error('Error prefetching diff content:', error);
      set({ isFetchingDiff: false });
    }
  },
  
  reset: () => set(initialState),
}));
