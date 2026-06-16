import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  ScrollArea,
  Badge,
  Separator,
  Spinner,
} from '@radix-ui/themes';
import RichTextEditor from 'components/TipTap/TipTap';
import AISparkle from 'components/icons/AISparkle';
import { Pencil } from 'lucide-react';
import { VIEWS } from 'constants/dashboard';
import type { Recommendation, ViewType } from 'types/dashboard';
import KBScoreCard from './KBScoreCard';
import SuccessDialog from './SuccessDialog';
import Image from 'next/image';
interface RefactorViewProps {
  recommendation: Recommendation;
  // onSetView: (view: ViewType) => void;
  isLoadingForRefactor: boolean;
  showSuccessDialogForRefactor: boolean;
  setShowSuccessDialogForRefactor: (show: boolean) => void;
  isEditingForRefactor: boolean;
  setIsEditingForRefactor: (isEditing: boolean) => void;
  enabledCompareForRefactor: boolean;
  showImprovedContent: boolean;
  setShowImprovedContent: (show: boolean) => void;
}

const DocumentDisplay: React.FC<{ url: string }> = ({ url }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <Box className="h-[82vh] border rounded-md bg-white">
      <ScrollArea>
        <Box p="4">
          {isLoading && (
            <Flex justify="center" align="center" className="h-32">
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
            className="w-full h-[78vh]"
            onLoad={() => setIsLoading(false)}
            onError={() => setError('Failed to load document')}
          />
        </Box>
      </ScrollArea>
    </Box>
  );
};

const EditorPanel: React.FC<{
  content: string;
  onChange: (content: string) => void;
  disabled: boolean;
}> = React.memo(({ content, onChange, disabled }) => (
  <Box className="h-[82vh] border rounded-md">
    <ScrollArea>
      <Box p="4">
        <RichTextEditor
          content={content}
          onChange={onChange}
          disabled={disabled}
        />
      </Box>
    </ScrollArea>
  </Box>
));

// Main Component
const RefactorView: React.FC<RefactorViewProps> = ({
  recommendation,
  // onSetView,
  isLoadingForRefactor,
  showSuccessDialogForRefactor,
  setShowSuccessDialogForRefactor,
  isEditingForRefactor,
  setIsEditingForRefactor,
  enabledCompareForRefactor,
  showImprovedContent,
  setShowImprovedContent,
}) => {
  console.log('recommendation in refactor:====>', recommendation);
  const [content, setContent] = useState(recommendation.content);
  const suggestedChanges = recommendation.statistics?.suggested_changes ?? [];
  const hasSuggestedChanges = suggestedChanges.length > 0;

  const documentUrl = useMemo(
    () => recommendation?.kb_data[0]?.access_url || '',
    [recommendation.kb_data],
  );

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setIsEditingForRefactor(true);
  }, []);

  const handleApplyAll = useCallback(() => {
    setShowImprovedContent(!showImprovedContent);
    if (!showImprovedContent) {
      setIsEditingForRefactor(false);
    }
  }, [showImprovedContent]);

  const renderContent = () => {
    if (enabledCompareForRefactor) {
      return (
        <Flex direction="row" gap="0">
          {/* Left Panel - Original Document */}
          <Box className="w-1/2">
            <Flex justify="between" p="2" className="border-b">
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
          </Box>

          {/* Right Panel - Editor */}
          <Box className="w-1/2">
            <Flex justify="between" p="2" className="border-b">
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
            <EditorPanel
              content={content}
              onChange={handleContentChange}
              disabled={isLoadingForRefactor || !isEditingForRefactor}
            />
          </Box>
        </Flex>
      );
    }

    // Non-compare mode
    return (
      <Flex direction="row" gap="4">
        {/* Left Panel - Editor/Document Display */}
        <Box className="w-3/5">
          <Flex justify="between" p="2" className="border-b">
            <Flex align="center" gap="2" className="items-center">
              <AISparkle />
              <Text size="5" weight="bold">
                {showImprovedContent ? 'Updated Article' : 'Original Document'}
              </Text>
              {!showImprovedContent && (
                <Badge size="1" color="gray" variant="outline">
                  View Only
                </Badge>
              )}
              {isEditingForRefactor && showImprovedContent && (
                <Badge size="1" color="orange" variant="soft">
                  Editing
                </Badge>
              )}
            </Flex>
            {showImprovedContent && (
              <Button
                variant="soft"
                disabled={isLoadingForRefactor}
                onClick={() => setIsEditingForRefactor(!isEditingForRefactor)}
              >
                {isEditingForRefactor ? 'Preview' : 'Edit'}
              </Button>
            )}
          </Flex>
          {showImprovedContent ? (
            <EditorPanel
              content={content}
              onChange={handleContentChange}
              disabled={isLoadingForRefactor || !isEditingForRefactor}
            />
          ) : (
            <DocumentDisplay url={documentUrl} />
          )}
        </Box>

        {/* Right Panel - AI Suggestions */}
        <Box className="w-2/5">
          <KBScoreCard
            score={recommendation?.statistics ? recommendation?.statistics?.score * 10 : 0}
            clarity={recommendation?.statistics ? recommendation?.statistics?.clarity * 10 : 0}
            correctness={recommendation?.statistics ? recommendation?.statistics?.correctness * 10 : 0}
            keyword_coverage={recommendation?.statistics ? recommendation?.statistics?.keyword_coverage * 10 : 0}
            engagement={recommendation?.statistics ? recommendation?.statistics?.engagement * 10 : 0}
          />

          <Box className="w-full bg-white flex flex-col mt-4">
            <Flex
              justify="between"
              align="center"
              p="1"
              className="flex-shrink-0"
            >
              <Flex align="center" gap="2">
                <AISparkle />
                <Text size="5" weight="bold">
                  AI Suggestions
                </Text>
              </Flex>
              {hasSuggestedChanges && (
              <Button size="2" onClick={handleApplyAll}>
                <Pencil className="h-4 w-4 mr-2" />
                {showImprovedContent ? 'Back to Original' : 'Apply All'}
              </Button>
              )}
            </Flex>
            <ScrollArea>
              <Box className="p-4">
                <Text className="text-md font-medium text-gray-700">
                  Improvements
                </Text>
                {hasSuggestedChanges ? (
                  <div className="space-y-2">
                    {suggestedChanges.map(
                      (improvement, index) => (
                        <div key={index} className="rounded-md border border-[#E4E4FB] p-3">
                          <div className="flex items-start space-x-2">
                            <div className="flex-grow">
                              <p className="text-sm text-[var(--iris-9)]">
                                -
{' '}
{improvement}
                              </p>
                              {/* <p className="text-sm text-blue-800">
                                →{improvement[1]}
                              </p> */}
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <Box className="mb-2 p-3 bg-gray-50 rounded-md">
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <Image 
                                        src="/img/noImprovements.png"
                                        alt="Descriptive Text"
                                        width={200}
                                        height={200}
                                        className="text-blue-500"
                                        />
                                        <Text className="text-sm text-gray-500">
                                        No Improvements available
                                        </Text>
                                    </div>
                                    </Box>
                )}
              </Box>
            </ScrollArea>
          </Box>
        </Box>
      </Flex>
    );
  };

  return (
    <Box p="4">
      {renderContent()}

      <SuccessDialog
        open={showSuccessDialogForRefactor}
        onOpenChange={setShowSuccessDialogForRefactor}
        onClose={() => {
          setShowSuccessDialogForRefactor(false);
          // onSetView(VIEWS.DASHBOARD);
        }}
      />
    </Box>
  );
};

export default React.memo(RefactorView);
