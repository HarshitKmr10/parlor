'use client';

import React, { useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import withAuth from 'components/withAuth';
import type { Recommendation } from 'types/dashboard';
import { Box, Flex, Button, Text, Badge, ScrollArea } from '@radix-ui/themes';
import { ArrowLeft, Pencil } from 'lucide-react';
import RichTextEditor from 'components/TipTap/TipTap';
import AISparkle from 'components/icons/AISparkle';
import KBScoreCard from 'components/dashboard/KBScoreCard';
import Image from 'next/image';
const DocumentDisplay: React.FC<{ url: string }> = ({ url }) => (
  <Box className="h-[82vh] border rounded-md bg-white">
    <ScrollArea>
      <Box p="4">
        <iframe
          src={url}
          className="w-full h-[78vh]"
        />
      </Box>
    </ScrollArea>
  </Box>
);

const EditorPanel: React.FC<{
  content: string;
  onChange: (content: string) => void;
  disabled: boolean;
}> = React.memo(({ content, onChange, disabled }) => (
  <Box className="h-[90vh] border rounded-md">
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

function RefactorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const encodedData = searchParams.get('data');
  let recommendation: Recommendation | null = null;
  
  try {
    if (encodedData) {
      const decodedData = atob(encodedData);
      recommendation = JSON.parse(decodedData);
    }
  } catch (error) {
    console.error('Error parsing recommendation data:', error);
  }

  const [content, setContent] = useState(recommendation?.content || '');
  const [isEditing, setIsEditing] = useState(false);
  const [showImprovedContent, setShowImprovedContent] = useState(false);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setIsEditing(true);
  }, []);

  const handleApplyAll = useCallback(() => {
    setShowImprovedContent(!showImprovedContent);
    if (!showImprovedContent) {
      setIsEditing(false);
    }
  }, [showImprovedContent]);

  if (!recommendation) {
    return <div>Invalid or missing document data</div>;
  }

  const documentUrl = recommendation?.kb_data[0]?.access_url || '';

  // Helper function to check if improvements are available
  const hasImprovements = recommendation?.statistics?.suggested_changes && 
    recommendation.statistics.suggested_changes.length > 0;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <Flex 
        justify="between" 
        align="center" 
        className="h-14 border-b border-[var(--gray-8)] px-4 flex-shrink-0 bg-white"
      >
        <Flex align="center" gap="3">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="p-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-[18px] font-medium">
            Improve Knowledge Article
          </span>
        </Flex>
        
        <Flex gap="3">
          {hasImprovements && (
            <>
              <Button variant="soft" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button variant="solid">Create KB</Button>
              <Button variant="solid">Download</Button>
          </>
          )}
        </Flex>
      </Flex>

      {/* Main Content */}
      <Box p="4">
        <Flex direction="row" gap="0">
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
                {isEditing && showImprovedContent && (
                  <Badge size="1" color="orange" variant="soft">
                    Editing
                  </Badge>
                )}
              </Flex>
              {showImprovedContent && (
                <Button
                  variant="soft"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'Preview' : 'Edit'}
                </Button>
              )}
            </Flex>
            {showImprovedContent ? (
              <EditorPanel
                content={content}
                onChange={handleContentChange}
                disabled={!isEditing}
              />
            ) : (
              <DocumentDisplay url={documentUrl} />
            )}
          </Box>

          {/* Right Panel - AI Suggestions */}
          <Box className="w-2/5" pt="7">
            <KBScoreCard
              score={recommendation?.statistics?.score * 10 || 0}
              clarity={recommendation?.statistics?.clarity * 10 || 0}
              correctness={recommendation?.statistics?.correctness * 10 || 0}
              keyword_coverage={recommendation?.statistics?.keyword_coverage * 10 || 0}
              engagement={recommendation?.statistics?.engagement * 10 || 0}
            />

            <Box className="w-full bg-white flex flex-col mt-4">
              <Flex justify="between" align="center" p="1" className="flex-shrink-0">
                <Flex align="center" gap="2">
                  <AISparkle />
                  <Text size="5" weight="bold">
                    AI Suggestions
                  </Text>
                </Flex>
                {hasImprovements && (
                  <Button size="2" onClick={handleApplyAll}>
                    <Pencil className="h-4 w-4 mr-2" />
                    {showImprovedContent ? 'Back to Original' : 'Apply All'}
                  </Button>
                )}
              </Flex>
              <ScrollArea>
                <Box className="p-4">
                  
                  {hasImprovements ? (
                    <div className="space-y-2">
                      <Text className="text-md font-medium text-gray-700">
                        Improvements
                      </Text>
                      {recommendation.statistics.suggested_changes.map((improvement, index) => (
                        <div key={index} className="rounded-md border border-[#E4E4FB] p-3">
                          <div className="flex items-start space-x-2">
                            <div className="flex-grow">
                              <p className="text-sm text-[var(--iris-9)]">
                                - {improvement}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
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
      </Box>
    </div>
  );
}

export default (RefactorPage);
