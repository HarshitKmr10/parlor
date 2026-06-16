import React, { useState, useCallback, useMemo } from 'react';
import {
  Flex,
  Text,
  Button,
  ScrollArea,
  Badge,
  Spinner,
} from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import RichTextEditor from 'components/TipTap/TipTap';
import AISparkle from 'components/icons/AISparkle';
import type { Recommendation } from 'types/dashboard';
import SuccessDialog from './SuccessDialog';

interface OutdatedViewProps {
  recommendation: Recommendation;
  isLoadingForRefactor: boolean;
  isEditingForRefactor: boolean;
  setIsEditingForRefactor: (isEditing: boolean) => void;
  showImprovedContent: boolean;
  setShowImprovedContent: (show: boolean) => void;
  showSuccessDialogForRefactor: boolean;
  setShowSuccessDialogForRefactor: (show: boolean) => void;
}

const DocumentDisplay: React.FC<{ url: string }> = ({ url }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <Flex className="flex-1 min-h-0 border rounded-md bg-white overflow-hidden">
      {isLoading && (
        <Flex justify="center" align="center" className="h-full w-full" position="absolute">
          <Spinner />
        </Flex>
      )}
      {!!error && (
        <Flex
          direction="column"
          justify="center"
          align="center"
          className="h-32"
        >
          <Text color="red">Error loading document</Text>
          <Text size="2">{error}</Text>
        </Flex>
      )}
      <iframe
        src={url}
        className="w-full"
        onLoad={() => setIsLoading(false)}
        onError={() => setError('Failed to load document')}
      />
    </Flex>
  );
};

// Main Component
const OutdatedView: React.FC<OutdatedViewProps> = ({
  recommendation,
  isLoadingForRefactor,
  isEditingForRefactor,
  setIsEditingForRefactor,
  showSuccessDialogForRefactor,
  setShowSuccessDialogForRefactor,
  // onSetView,
}) => {
  const [content, setContent] = useState(recommendation?.content);

  const documentUrl = useMemo(
    () => recommendation?.kb_data?.[0]?.access_url || '',
    [recommendation?.kb_data]
  );

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setIsEditingForRefactor(true);
  }, []);

  const renderContent = () => (
    <Flex direction="row" gap="4" className='w-full min-h-0 flex-1'>
      {/* Left Panel - Original Document */}
      <Flex direction="column" className="w-1/2 min-h-0 flex-1">
        <Flex justify="between" p="2">
          <Flex align="center" gap="2">
            <Text size="5" weight="bold">
              Original Document
            </Text>
            <Badge size="1" color="gray" variant="outline">
              View Only
            </Badge>
          </Flex>
        </Flex>
        <DocumentDisplay url={documentUrl} />
      </Flex>

      {/* Right Panel - Markdown View/Editor */}
      <Flex direction="column" className="w-1/2 min-h-0">
        <Flex justify="between" p="2">
          <Flex align="center" gap="2">
            <AISparkle />
            <Text size="5" weight="bold">
              Updated Article
            </Text>
            {isEditingForRefactor && (
              <Badge size="1" color="orange" variant="soft">
                Editing
              </Badge>
            )}
          </Flex>
          <Button
            variant="soft"
            disabled={isLoadingForRefactor}
            onClick={() => setIsEditingForRefactor(!isEditingForRefactor)}
          >
            {isEditingForRefactor ? 'Preview' : 'Edit'}
          </Button>
        </Flex>
        <Flex className="h-[calc(100vh-190px)] border rounded-md w-full">
          <ScrollArea className="p-4">
            <RichTextEditor
              content={content}
              onChange={handleContentChange}
              disabled={isLoadingForRefactor || !isEditingForRefactor}
            />
          </ScrollArea>
        </Flex>
      </Flex>
    </Flex>
  );

  return (
    <Flex p="4" className="min-h-0 flex-1">
      {renderContent()}

      <SuccessDialog
        open={showSuccessDialogForRefactor}
        onOpenChange={setShowSuccessDialogForRefactor}
        onClose={() => {
          setShowSuccessDialogForRefactor(false);
          // onSetView(VIEWS.DASHBOARD);
        }}
      />
    </Flex>
  );
};

export default React.memo(OutdatedView);
