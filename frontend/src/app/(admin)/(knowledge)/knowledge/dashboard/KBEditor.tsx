import React, { useState, useEffect } from 'react';
import { Box, Flex, Text, Card, Button, Spinner } from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import axios from 'axios';
import RichTextEditor from 'components/TipTap/TipTap';
import AISuggestions from 'utils/AISuggestions';
import { useGlobalContext } from 'contexts/store';

// Add this type definition at the top of the file

interface KBEditorProps {
  initialContent: string;
  updatedContent: string;
  showCompareChanges: boolean;
  onContentChange: (content: string) => void;
  onToggleCompareChanges: () => void;
  setUpdatedContent: (content: string) => void;
  setShowCompareChanges: (show: boolean) => void;
  onModeChange: (showCompareChanges: boolean) => void;
}

interface Suggestion {
  heading: string;
  reason: string;
  ticket_link: string;
  ticket_id: string;
}

function KBEditor({
  initialContent,
  updatedContent,
  showCompareChanges,
  onContentChange,
  onToggleCompareChanges,
  setUpdatedContent,
  setShowCompareChanges,
  onModeChange,
}: KBEditorProps) {
  const [content, setContent] = useState(initialContent);
  const aiBackedUrl = process.env.NEXT_PUBLIC_AI_AGENT_API_URL;
  const [originalContent, setOriginalContent] = useState(initialContent);
  const [kbScore, setKbScore] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [improvements, setImprovements] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const { user } = useGlobalContext();
  useEffect(() => {
    updateScoresAndSuggestions(content);
  }, [content, user]);

  const sanitizeContent = (content: string) =>
    // Replace any double quotes with single quotes
    // and remove any newline characters
    content.replace(/"/g, "'").replace(/\n/g, ' ').trim();
  const updateScoresAndSuggestions = async (newContent: string) => {
    setIsLoading(true);
    try {
      const body = {
        action: 'create_new_kb_with_existing_kb',
        data: {
          kb_ids: null,
          metadata: {
            existing_kb: sanitizeContent(newContent),
            ticket_data: [
              {
                ticket_id: 'INC0012449',
                ticket_title: 'Issue with POS system connection issue',
                ticket_description: sanitizeContent(
                  'User was facing issue with POS System connection issue, the provided steps have resolved the problem. Check DHCP Server Action: Ensure the DHCP server is operational and has available IP addresses to assign. Tools Needed: DHCP management console. Steps: - Log into the DHCP server. - Verify that the scope has available IP addresses. - Check for any unauthorized devices consuming IP addresses and adjust settings or lease times as needed. ',
                ),
                ticket_link:
                  'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Db687a27dc3295e90c271554d0501318c',
              },
              {
                ticket_id: 'INC0012448',
                ticket_title: 'Issue with POS system connection issue',
                ticket_description: sanitizeContent(
                  'User was facing issue with POS System connection issue, the provided steps have resolved the problem. Contact IT Support Action: If the above steps do not resolve the issue, escalate to the IT support team. Tools Needed: Internal support contact information. Steps: - Provide a detailed report of actions taken and symptoms observed. - Request advanced diagnostics from network specialists.',
                ),
                ticket_link:
                  'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3D00e6623dc3295e90c271554d050131b6',
              },
            ],
          },
        },
      };
      
      // Send the body directly, not wrapped in another object
      const response = await axios.post(`${aiBackedUrl}/api/v1/knowledgeassist/action`, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.access_token}`,
        },
      });

      setKbScore(75);
      setSuggestions(response.data.data.justification);
      setImprovements(response.data.data.improvement_suggestions);
      setApiResponse(response.data.data.content);
      setUpdatedContent(response.data.data.content);
    } catch (error) {
      console.error('Error updating KB scores and suggestions:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response data:', error.response.data);
        if (error.response.status === 422) {
          console.error('Validation error:', error.response.data);
          // Handle validation errors (e.g., display to user)
        }
      }
      // Set default values or error state
      setKbScore(0);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    onContentChange(newContent);
  };

  const handleApplyAll = () => {
    if (apiResponse) {
      setUpdatedContent(apiResponse);
      setShowCompareChanges(true);
      onModeChange(true);
      onToggleCompareChanges();
    } else {
      console.error('No valid API response to apply changes from');
    }
  };

  const handleToggleMode = () => {
    if (showCompareChanges) {
      setShowCompareChanges(false);
      setContent(updatedContent); // Show the updated content when returning to suggestions
    } else {
      setShowCompareChanges(true);
    }
    onModeChange(!showCompareChanges);
    onToggleCompareChanges();
  };

  const renderKBScore = (score: number) => {
    const createArc = (startAngle: number, endAngle: number, color: string) => {
      const start = polarToCartesian(50, 50, 45, endAngle);
      const end = polarToCartesian(50, 50, 45, startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
      return `M ${start.x} ${start.y} A 45 45 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
    };

    const polarToCartesian = (
      centerX: number,
      centerY: number,
      radius: number,
      angleInDegrees: number,
    ) => {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
      return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
      };
    };

    const scorePercentage = score / 100;
    const redEnd = -60;
    const orangeEnd = 0;
    const greenEnd = 60;

    return (
      <Card className="mb-[-46px] w-full bg-white p-4 pb-0">
        <Flex align="center" gap="2" mb="4">
          <Text weight="bold" size="5">
            KB Score
          </Text>
          <InfoCircledIcon className="text-gray-400" />
        </Flex>
        <Flex>
          <Box className="w-2/5">
            <Flex direction="row" align="center">
              <Flex direction="row" align="center" gap="10px">
                <svg width="168" height="168" viewBox="0 0 100 100">
                  <path
                    d={createArc(-90, 90, '#e0e0e0')}
                    fill="none"
                    stroke="#e0e0e0"
                    strokeWidth="10"
                  />
                  <path
                    d={createArc(-90, redEnd, '#ef4444')}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="10"
                  />
                  <path
                    d={createArc(redEnd, orangeEnd, '#f97316')}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="10"
                  />
                  <path
                    d={createArc(orangeEnd, greenEnd, '#22c55e')}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="10"
                  />
                  {/* <path d={createArc(-90, -90 + (180 * scorePercentage), '#000')} fill="none" stroke="#000" strokeWidth="2" /> */}
                  <text
                    x="40"
                    y="40"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="15"
                    fontWeight="bold"
                  >
                    {score}
                  </text>
                  <text
                    x="60"
                    y="40"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="12"
                    fill="#888"
                  >
                    /100
                  </text>
                </svg>
                {/* <Flex direction="column" align="center" gap="2" mt="-50px">
                  <Text size="2">
                    Avg
                    <span className="inline-block w-4 text-center">中</span> 70%
                  </Text>
                  <Text size="2">
                    Top
                    <span className="inline-block w-4 text-center">↑</span> 95%
                  </Text>
                </Flex> */}
              </Flex>
            </Flex>
          </Box>
          <Box className="w-3/5">
            <Flex wrap="wrap" gap="4">
              {[
                { label: 'Correctness', value: 76, color: 'bg-red-500' },
                { label: 'Clarity', value: 42, color: 'bg-blue-500' },
                { label: 'Keywords', value: 67, color: 'bg-teal-500' },
                { label: 'Engagement', value: 70, color: 'bg-indigo-500' },
              ].map((item) => (
                <Box key={item.label} className="w-[calc(50%-8px)]">
                  <Flex justify="between" mb="1">
                    <Text size="2" color="gray">
                      {item.label}
                    </Text>
                    <Text size="2" weight="bold">
                      {item.value}%
                    </Text>
                  </Flex>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-2 rounded-full ${item.color}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </Box>
              ))}
            </Flex>
          </Box>
        </Flex>
      </Card>
    );
  };

  return (
    <Box className="flex h-screen flex-col overflow-hidden">
      <Flex className="flex-grow">
        <Box className="h-full w-1/2 pr-4">
          {showCompareChanges && (
            <Flex justify="between" align="center" mb="3">
              <Text size="5" weight="bold" className="ml-[10px]">
                Old KB
              </Text>
            </Flex>
          )}
          <Box className="h-[calc(100vh-120px)] overflow-y-auto rounded-md border border-[var(--gray-6)]">
            <RichTextEditor
              content={showCompareChanges ? originalContent : content}
              onChange={handleContentChange}
            />
          </Box>
        </Box>

        <Box className="h-full w-1/2">
          {showCompareChanges ? (
            <Box className="h-full">
              <Flex justify="between" align="center" mb="3">
                <Text size="5" weight="bold" className="ml-[10px]">
                  New KB
                </Text>
              </Flex>
              <Box className="h-[calc(100vh-120px)] overflow-y-auto rounded-md border border-[var(--gray-6)]">
                <RichTextEditor
                  content={updatedContent}
                  onChange={(newContent) => setUpdatedContent(newContent)}
                />
              </Box>
            </Box>
          ) : isLoading ? (
            <Flex justify="center" align="center" className="h-full">
              <Spinner size="3" />
            </Flex>
          ) : (
            <Box className="flex h-full flex-col">
              <Box className="mb-0 flex-shrink-0">
                <Flex align="center" gap="2">
                  {renderKBScore(kbScore)}
                </Flex>
              </Box>
              <Box className="flex-grow overflow-y-auto">
                <AISuggestions
                  improvements={improvements}
                  suggestions={suggestions}
                  onApplyAll={handleApplyAll}
                />
              </Box>
            </Box>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

export default KBEditor;
