import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Flex, Text, Button, ScrollArea, Badge, Select,
} from '@radix-ui/themes';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import RichTextEditor from 'components/TipTap/TipTap';
import AISparkle from 'components/icons/AISparkle';
import { LoadingCircle } from 'components/icons/LoadingCircle';
import { VIEWS } from 'constants/dashboard';
import { ViewType } from 'types/dashboard';
import SuccessDialog from './SuccessDialog';
import RelatedIncidentsTable from './RelatedIncidentsTable';
import { useDashboard } from 'hooks/useDashboard';
import { apiService } from 'services/dashboard';

interface CreateKBViewProps {
  isLoadingForCreateKB: boolean;
  showSuccessDialogForCreateKB: boolean;
  setShowSuccessDialogForCreateKB: (open: boolean) => void;
  isEditingForCreateKB: boolean;
  setIsEditingForCreateKB: (open: boolean) => void;
  onSetView: (view: ViewType) => void;
}

const CreateKBView: React.FC<CreateKBViewProps> = ({
  isLoadingForCreateKB,
  showSuccessDialogForCreateKB,
  setShowSuccessDialogForCreateKB,
  isEditingForCreateKB,
  setIsEditingForCreateKB,
  onSetView,
}) => {
  const { t } = useTranslation();
  const { selectedRecommendation: recommendation, setSelectedRecommendation } = useDashboard();
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isChangingTemplate, setIsChangingTemplate] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  


  const tickets = useMemo(
    () =>
      recommendation?.ticket_data ? (Array.isArray(recommendation.ticket_data)
        ? recommendation.ticket_data
        : [recommendation.ticket_data]) : [],
    [recommendation?.ticket_data],
  );

  // Fetch templates when component mounts
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const response = await serviceDeskInstance.get('/service_desk/knowledgebase_templates');
        setTemplates(response.data.data || []);
      } catch (error) {
        console.error('Error fetching templates:', error);
        setTemplates([]);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, []);

  // Set selected template ID from recommendation
  useEffect(() => {
    if (recommendation?.selected_template_id) {
      setSelectedTemplateId(recommendation.selected_template_id);
    }
  }, [recommendation?.selected_template_id]);

  const handleContentChange = useCallback((newContent: string) => {
    setSelectedRecommendation(prev => ({
      ...prev!,
      content: newContent
    }));
    setIsEditingForCreateKB(true);
  }, [setSelectedRecommendation]);

  const handleTemplateChange = useCallback((templateId: string) => {
    const templateIdInt = parseInt(templateId);
    setSelectedTemplateId(templateIdInt);
    
    if (!recommendation) return;
    
    // Handle the async operation without blocking the UI update
    (async () => {
      try {
        setIsChangingTemplate(true);
        // Use the new convert template API
        const result = await apiService.convertTemplate(recommendation.content, templateIdInt);
        
        // Update the recommendation with the new content and template ID
        const updatedRecommendation = {
          ...recommendation,
          content: result.content,
          selected_template_id: templateIdInt,
        };
        setSelectedRecommendation(updatedRecommendation);
        
        // Force editor re-render only after template conversion
        setEditorKey(prev => prev + 1);
      } catch (error) {
        console.error('Error changing template:', error);
        // Revert the template selection on error
        setSelectedTemplateId(recommendation.selected_template_id || null);
      } finally {
        setIsChangingTemplate(false);
      }
    })();
  }, [recommendation, setSelectedRecommendation]);

  return (
    <Flex className="flex-2 min-h-0 p-4">
      <Flex direction="row" gap="4" className="flex-1 min-h-0">
        {/* Left Panel - AI Recommended KB */}
        <Flex direction="column" className="flex-1 min-w-0 lg:w-3/5 min-h-0">
          {/* Header with title, template dropdown, and edit button */}
          <Flex direction="column" gap="3" mb="4">
            <Flex align="center" justify="between" wrap="wrap" gap="3">
              <Flex align="center" gap="2" className="min-w-0">
                <AISparkle />
                <Text size="5" weight="bold" className="whitespace-nowrap">
                  {t('knowledge_assist.aiRecommendedKB')}
                </Text>
                {isEditingForCreateKB && (
                  <Badge size="1" color="orange" variant="soft">
                    {t('knowledge_assist.editing')}
                  </Badge>
                )}
              </Flex>
              
              <Flex align="center" gap="3" className="flex-shrink-0">
                {/* Template Selection Dropdown - inline with title */}
                {selectedTemplateId !== null && (
                  <Flex align="center" gap="2" className="min-w-0">
                    <Text size="2" weight="medium" color="gray" className="whitespace-nowrap">
                      {t('knowledge_assist.template', 'Template')}:
                    </Text>
                    <div className="min-w-[200px]">
                      <Select.Root
                        value={selectedTemplateId ? selectedTemplateId.toString() : undefined}
                        onValueChange={handleTemplateChange}
                        disabled={isLoadingTemplates || isLoadingForCreateKB || isChangingTemplate}
                      >
                        <Select.Trigger 
                          placeholder={
                            isLoadingTemplates 
                              ? t('knowledge_assist.loadingTemplates', 'Loading templates...') 
                              : t('knowledge_assist.selectTemplate', 'Select a template')
                          }
                        />
                        <Select.Content>
                          {templates.length > 0 ? (
                            templates.map((template) => (
                              <Select.Item key={template.id} value={template.id.toString()}>
                                <Text size="2" weight="medium">{template.name}</Text>
                              </Select.Item>
                            ))
                          ) : (
                            !isLoadingTemplates && (
                              <Select.Item value="no-templates" disabled>
                                <Text size="2" color="gray">
                                  {t('knowledge_assist.noTemplates', 'No templates available')}
                                </Text>
                              </Select.Item>
                            )
                          )}
                        </Select.Content>
                      </Select.Root>
                    </div>
                  </Flex>
                )}
                
                <Button
                  variant="soft"
                  disabled={isLoadingForCreateKB}
                  onClick={() => setIsEditingForCreateKB(!isEditingForCreateKB)}
                  className="flex-shrink-0"
                >
                  {isEditingForCreateKB ? t('knowledge_assist.preview') : t('knowledge_assist.edit')}
                </Button>
              </Flex>
            </Flex>
          </Flex>

          <Flex className="border rounded-md flex-1 min-h-0 relative">
            {isChangingTemplate && (
              <Flex 
                className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 rounded-md"
                align="center"
                justify="center"
                direction="column"
                gap="2"
              >
                <LoadingCircle />
                <Text size="2" color="blue" weight="medium">
                  {t('knowledge_assist.convertingTemplate', 'Converting to new template...')}
                </Text>
              </Flex>
            )}
            <ScrollArea className="min-h-0 flex-1 p-4">
              <RichTextEditor
                key={`editor-${editorKey}`}
                content={recommendation?.content}
                onChange={handleContentChange}
                disabled={isLoadingForCreateKB || !isEditingForCreateKB || isChangingTemplate}
              />
            </ScrollArea>
          </Flex>
        </Flex>

        {/* Right Panel - Related Incidents */}
        <Flex direction="column" className="flex-shrink-0 w-full lg:w-2/5 min-w-0 overflow-y-auto">
          <Flex align="center" gap="2" mb="4">
            <Text size="5" weight="bold">
              {t('knowledge_assist.relatedIncidents')}
            </Text>
            <Badge variant="soft" size="1">
              {tickets.length}
            </Badge>
          </Flex>
          {/* <KBScoreCard
            score={recommendation.statistics ? recommendation.statistics.score * 10 : 0}
            clarity={recommendation.statistics ? recommendation.statistics.clarity * 10 : 0}
            correctness={recommendation.statistics ? recommendation.statistics.correctness * 10 : 0}
            keyword_coverage={recommendation.statistics ? recommendation.statistics.keyword_coverage * 10 : 0}
            engagement={recommendation.statistics ? recommendation.statistics.engagement * 10 : 0}
          /> */}
          <RelatedIncidentsTable tickets={tickets} />
        </Flex>
      </Flex>

      <SuccessDialog
        open={showSuccessDialogForCreateKB}
        onOpenChange={setShowSuccessDialogForCreateKB}
        onClose={() => {
          setShowSuccessDialogForCreateKB(false);
          onSetView(VIEWS.DASHBOARD);
        }}
      />
    </Flex>
  );
};

export default CreateKBView;
