import React, { useState, useCallback, useMemo } from 'react';
import {
  Box, Flex, Text, Badge, Select, IconButton,
} from '@radix-ui/themes';
import { VIEWS } from 'constants/dashboard';
import { Recommendation } from 'types/dashboard';
import AISparkle from 'components/icons/AISparkle';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SuccessDialog from './SuccessDialog';
import DocumentDisplay from './DocumentDisplay';
import EditorPanel from './EditorPanel';

interface TranslateViewProps {
  recommendation: Recommendation;
  // onSetView: (view: typeof VIEWS[keyof typeof VIEWS]) => void;
  isLoadingForTranslate: boolean;
  showSuccessDialogForTranslate: boolean;
  setShowSuccessDialogForTranslate: (show: boolean) => void;
  isEditingForTranslate: boolean;
  setIsEditingForTranslate: (editing: boolean) => void;
}

function TranslateView({
  recommendation,
  // onSetView,
  isLoadingForTranslate,
  showSuccessDialogForTranslate,
  setShowSuccessDialogForTranslate,
  isEditingForTranslate,
  setIsEditingForTranslate,
}: TranslateViewProps) {
  const [translatedContent, setTranslatedContent] = useState(recommendation.content);
  console.log('recommendation', recommendation);
  const currentKbUrl = recommendation?.kb_data[0]?.access_url || '';

  const handleContentChange = useCallback((newContent: string) => {
    setTranslatedContent(newContent);
    setIsEditingForTranslate(true);
  }, []);

  return (
    <Box p="4">
      <Flex direction="row" gap="4">
        {/* Left Panel - Original Document */}
       
        <Box className="w-1/2">
          <Flex justify="between" p="2" className="border-b">
            <Flex align="center" gap="2">
              <Text size="5" weight="bold">Original KB</Text>
              <Badge size="1" color="gray" variant="outline">View Only</Badge>
            </Flex>
          </Flex>
          <DocumentDisplay url={currentKbUrl} />
        </Box>

        {/* Right Panel - Translation Editor */}
        <Box className="w-1/2">
          <Flex justify="between" p="2" className="border-b">
            <Flex align="center" gap="2">
            <AISparkle/>
              <Text size="5" weight="bold">AI Translated KB</Text>
            </Flex>
          </Flex>
          <EditorPanel
            content={translatedContent}
            onChange={handleContentChange}
            disabled={isLoadingForTranslate}
          />
        </Box>
      </Flex>
      
    

 

      <SuccessDialog
        open={showSuccessDialogForTranslate}
        onOpenChange={setShowSuccessDialogForTranslate}
        onClose={() => {
          setShowSuccessDialogForTranslate(false);
          // onSetView(VIEWS.DASHBOARD);
        }}
      />
    </Box>
  );
}

export default React.memo(TranslateView);
