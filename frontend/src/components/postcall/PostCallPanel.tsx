import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, Box, Flex, Button } from '@radix-ui/themes';
import { DownloadIcon } from '@radix-ui/react-icons';
import PostCallTranscript from './PostCallTranscript';
import PostCallSummary from './PostCallSummary';
import PostCallEntities from './PostCallEntities';
import { PostCallSentiments } from './PostCallSentiments';
import CreateKBTabView from './CreateKBTabView';
import PostCallKeywords from './PostCallKeywords';
import { useSearchParams } from 'next/navigation';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType, TextRun } from 'docx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'react-toastify';
import { PostcallTopic } from 'types/postcallTopicTypes';
import { API } from 'api';

interface PostCallPanelProps {
  entity: string;
  summary: string;
  sentiment: string;
  transcript: string;
  loading: boolean;
  type?: 'PostCall' | 'P1' | 'KnowledgeAssist';
  meetingId?: string;
  meetingName?: string;
  meetingDate?: string;
  postcallTopics?: PostcallTopic[];
  isLoadingPostcallTopics?: boolean;
  setPostcallTopics?: (topics: PostcallTopic[]) => void;
  agentName?: string;
  callerName?: string;
  showSentiments?: boolean;
}

function PostCallPanel({
  entity,
  summary,
  transcript,
  sentiment,
  loading,
  type = 'PostCall',
  meetingId,
  meetingName,
  meetingDate,
  postcallTopics,
  isLoadingPostcallTopics,
  setPostcallTopics,
  agentName,
  callerName,
  showSentiments = true,
}: PostCallPanelProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'summary';
  const [kbContent, setKbContent] = useState('');
  const [isKbLoading, setIsKbLoading] = useState(false);

  // Store parsed transcript
  const parsedTranscript = useMemo(() => {
    const regex = /<strong>(.*?):<\/strong>\s*(.*?)(?=<br\/><br\/>|$)/g;

    const matches = transcript ? [...transcript.matchAll(regex)] : [];
    
    return matches?.map(match => {
      let speaker = match[1].trim();
      // Replace "Unknown" or "User" with the actual caller name if available
      if (speaker === 'Unknown' || speaker === 'User') {
        speaker = callerName || 'User';
      }
      return {
        speaker,
        text: match[2].replace(/<br\/>/g, '').trim()
      };
    }).filter(entry => entry.text);
  }, [transcript, callerName]);

  
  const shareTranscript = (text: string) => {
    const regex = /<strong>(.*?):<\/strong>\s*([\s\S]*?)(?=<strong>|$)/g;
    const matches = text ? [...text.matchAll(regex)] : [];

    return matches?.map((match) => {
      let user = match[1].trim();
      // Replace "Unknown" or "User" with the actual caller name if available
      if (user === 'Unknown' || user === 'User') {
        user = callerName || 'User';
      }
      return {
        user,
        content: match[2].trim().replace(/<br\/>/g, ''),
      };
    });
  };

  const handleCreateKB = async () => {
    if (!meetingId) return;
    setIsKbLoading(true);
    try {
      const response = await API.KnowledgeAI.getKBforTransitionMeeting(meetingId);
      if (!response.ok) {
        throw new Error(t('knowledge_assist.failedToCreateKB'));
      }
      const data = await response.json();
      setKbContent(data);
    } catch (error) {
      console.error('Error creating KB:', error);
    } finally {
      setIsKbLoading(false);
    }
  };

  const sendTranscript = shareTranscript(transcript);
  const createPDF = () => {
    const doc = new jsPDF();
    let yOffset = 20; // Start position
    const lineHeight = 7; // Height between lines
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const textWidth = 170;
    const indentation = 10; // Indentation for spoken content

    // Title
    doc.setFontSize(16);
    doc.text(t('knowledge_assist.meetingTranscript'), margin, yOffset);
    yOffset += lineHeight * 3; // Triple space after title

    // Use stored parsedTranscript
    parsedTranscript.forEach(entry => {
      // Calculate space needed for this entry
      doc.setFontSize(12);
      const textLines = doc.splitTextToSize(entry.text, textWidth - (margin + indentation));
      const entryHeight = ((textLines.length + 1) * lineHeight) + lineHeight; // +1 for speaker name

      // Check if we need a new page
      if (yOffset + entryHeight > pageHeight - margin) {
        doc.addPage();
        yOffset = margin;
      }

      // Speaker name in bold
      doc.setFont('helvetica', 'bold');
      doc.text(`${entry.speaker}:`, margin, yOffset);
      yOffset += lineHeight; // Move to next line for spoken content
      
      // Speaker's text with indentation
      doc.setFont('helvetica', 'normal');
      textLines.forEach((line: string) => {
        doc.text(line, margin + indentation, yOffset);
        yOffset += lineHeight;
      });
      
      // Add extra space between entries
      yOffset += lineHeight;
    });

    return doc;
  };

  const convertMarkdownToPlainText = (markdown: string | null | undefined): string => {
    if (!markdown) return '';
    
    return markdown
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Convert links to text
      .replace(/```[^`]*```/g, '') // Remove code blocks
      .replace(/`([^`]+)`/g, '$1'); // Remove inline code
  };

  const createSummaryPDF = () => {
    const doc = new jsPDF();
    let yOffset = 20;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const textWidth = 170;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(t('knowledge_assist.meetingSummary'), margin, yOffset);
    yOffset += lineHeight * 3;

    // Summary content
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const plainSummary = convertMarkdownToPlainText(summary);
    const summaryLines = doc.splitTextToSize(plainSummary, textWidth - margin);
    
    summaryLines.forEach((line: string) => {
      if (yOffset > pageHeight - margin) {
        doc.addPage();
        yOffset = margin;
      }
      doc.text(line, margin, yOffset);
      yOffset += lineHeight;
    });

    return doc;
  };

  const createDOCX = () => {
    const plainSummary = convertMarkdownToPlainText(summary || '');
    const plainEntity = convertMarkdownToPlainText(entity || '');
    const sections = plainSummary.split(/(?=-\s|•\s|\d+\.\s)/).filter(section => section.trim());

    // Summary Document with improved formatting
    const summaryDoc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: t('knowledge_assist.meetingSummary'),
            heading: HeadingLevel.TITLE,
            spacing: {
              before: 240,
              after: 240
            },
            alignment: AlignmentType.CENTER
          }),
          ...sections.map(section => 
            new Paragraph({
              children: [
                new TextRun({
                  text: section.trim(),
                  size: 24,
                }),
              ],
              spacing: {
                before: 120,
                after: 120,
                line: 360
              },
              alignment: AlignmentType.JUSTIFIED
            })
          ),
        ],
      }],
    });

    // Transcript Document
    const transcriptDoc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: t('knowledge_assist.meetingTranscript'),
            heading: HeadingLevel.TITLE,
            spacing: {
              after: 400 // Add more space after title
            }
          }),
          // Use stored parsedTranscript
          ...parsedTranscript.map(entry => [
            new Paragraph({
              text: entry.speaker + ":",
              spacing: {
                before: 400 // Add space before each new speaker
              }
            }),
            new Paragraph({
              text: entry.text,
              indent: {
                left: 720 // 0.5 inch in twips
              },
              spacing: {
                after: 200 // Add space after each entry
              }
            }),
          ]).flat(),
        ],
      }],
    });

    // Entity Document
    const entityDoc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: t('knowledge_assist.entityInformation'),
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            text: plainEntity,
          }),
        ],
      }],
    });

    return { summaryDoc, transcriptDoc, entityDoc };
  };

  const createEntityPDF = () => {
    const doc = new jsPDF();
    let yOffset = 20;
    const lineHeight = 7;
    const margin = 20;
    const textWidth = 170;

    // Title
    doc.setFontSize(16);
    doc.text(t('knowledge_assist.entityInformation'), margin, yOffset);
    yOffset += lineHeight * 3;

    // Entity content
    doc.setFontSize(12);
    const entityLines = doc.splitTextToSize(entity, textWidth - margin);
    entityLines.forEach((line: string) => {
      doc.text(line, margin, yOffset);
      yOffset += lineHeight;
    });

    return doc;
  };

  const convertToDateString = useCallback((datestamp: string): string => {
    try {
      const datePart = datestamp.split('T')[0];
      // const date = new Date(datePart);
      return datePart;
    } catch (error) {
      console.error('Error converting timestamp:', error, 'Timestamp:', datestamp);
      return 'Invalid Date';
    }
  }, []);

  const formattedMeetingDate = meetingDate ? convertToDateString(meetingDate) : 'Unknown Date';

  const handleExportAll = async () => {
    if (!meetingId) {
      toast.error(t('knowledge_assist.meetingIdRequired'));
      return;
    }

    // Validate required content
    if (!summary && !transcript && !entity && (!postcallTopics || postcallTopics.length === 0)) {
      toast.error(t('knowledge_assist.noContentAvailableToExport'));
      return;
    }

    try {
      const zip = new JSZip();

      // Create PDFs
      const summaryPdf = createSummaryPDF();
      const transcriptPdf = createPDF();
      const entityPdf = createEntityPDF();

      // Add PDFs to zip with proper naming
      // zip.file(`meeting_${meetingId}_summary.pdf`, summaryPdf.output('blob'));
      // zip.file(`meeting_${meetingId}_transcript.pdf`, transcriptPdf.output('blob'));

      zip.file(`${meetingName}_${formattedMeetingDate}_summary.pdf`, summaryPdf.output('blob'));
      zip.file(`${meetingName}_${formattedMeetingDate}_transcript.pdf`, transcriptPdf.output('blob'));
      // zip.file(`meeting_${meetingId}_entities.pdf`, entityPdf.output('blob'));

      // Add DOCX files
      const { summaryDoc, transcriptDoc, entityDoc } = createDOCX();
      const summaryBlob = await Packer.toBlob(summaryDoc);
      const transcriptBlob = await Packer.toBlob(transcriptDoc);
      // const entityBlob = await Packer.toBlob(entityDoc);
      
      // zip.file(`meeting_${meetingId}_summary.docx`, summaryBlob);
      // zip.file(`meeting_${meetingId}_transcript.docx`, transcriptBlob);

      zip.file(`${meetingName}_${formattedMeetingDate}_summary.docx`, summaryBlob);
      zip.file(`${meetingName}_${formattedMeetingDate}_transcript.docx`, transcriptBlob);

      // zip.file(`meeting_${meetingId}_entities.docx`, entityBlob);

      // Add KB documents
      if (postcallTopics?.length > 0) {
        const kbFolder = zip.folder("knowledge_base");
        
        for (const kb of postcallTopics) {
          if (!kb?.topic || !kb?.kb_entry) {
            console.warn('Skipping invalid KB entry:', kb);
            continue;
          }

          const plainTopic = convertMarkdownToPlainText(kb.topic) || 'Untitled Topic';
          const plainContent = convertMarkdownToPlainText(kb.kb_entry) || 'No content available';

          // Create DOCX with improved formatting
          const kbDoc = new Document({
            sections: [{
              properties: {},
              children: [
                new Paragraph({
                  text: plainTopic,
                  heading: HeadingLevel.TITLE,
                  spacing: {
                    before: 240,
                    after: 240
                  },
                  alignment: AlignmentType.CENTER
                }),
                // Add a separator line
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "─".repeat(50),
                      color: "808080"
                    })
                  ],
                  spacing: {
                    before: 240,
                    after: 240
                  },
                  alignment: AlignmentType.CENTER
                }),
                // Split content into paragraphs for better formatting
                ...plainContent.split('\n').map(paragraph => 
                  new Paragraph({
                    text: paragraph.trim(),
                    spacing: {
                      before: 120,
                      after: 120,
                      line: 360 // Increase line spacing
                    },
                    alignment: AlignmentType.JUSTIFIED
                  })
                ),
              ],
            }],
            styles: {
              paragraphStyles: [
                {
                  id: "Title",
                  name: "Title",
                  basedOn: "Normal",
                  next: "Normal",
                  quickFormat: true,
                  run: {
                    size: 32,
                    bold: true,
                    color: "000000"
                  }
                }
              ]
            }
          });

          const kbDocxBlob = await Packer.toBlob(kbDoc);
          const safeFileName = plainTopic
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase()
            .substring(0, 50);
          
          kbFolder?.file(`${safeFileName}.docx`, kbDocxBlob);
        }
      }

      // Generate and save zip file
      const content = await zip.generateAsync({ type: "blob" });
      // saveAs(content, `meeting_${meetingId}_export.zip`);
      saveAs(content, `${meetingName}_${formattedMeetingDate}_export.zip`);
      
      toast.success(t('knowledge_assist.successfullyExportedMeetingData'));
    } catch (error) {
      console.error('Export error:', error);
      console.error('Data state:', {
        summaryLength: summary?.length,
        transcriptLength: transcript?.length,
        entityLength: entity?.length,
        topicsCount: postcallTopics?.length,
      });
      toast.error(t('knowledge_assist.failedToExportMeetingData'));
    }
  };

  const handleUpdatePostcallTopics = useCallback((updatedTopics: PostcallTopic[]) => {
    setPostcallTopics?.(updatedTopics);
  }, []);

  return (
    <Flex direction="column" className="h-full border-[var(--gray-8)]">
      <Tabs.Root defaultValue={defaultTab} className="flex flex-col h-full">
        <Box className="flex-shrink-0 bg-[var(--color-background)]">
          <Flex justify="between" align="center" px="4">
            <Tabs.List>
              <Tabs.Trigger className="cursor-pointer" value="transcript">
                {t('knowledge_assist.transcript')}
              </Tabs.Trigger>
              <Tabs.Trigger className="cursor-pointer" value="summary">
                {t('knowledge_assist.summary')}
              </Tabs.Trigger>
              <Tabs.Trigger className="cursor-pointer" value="keyWords">
                {t('knowledge_assist.keywords')}
              </Tabs.Trigger>
              {type === 'KnowledgeAssist' && (
                <Tabs.Trigger className="cursor-pointer" value="createKB">
                  {t('knowledge_assist.createDocument')}
                </Tabs.Trigger>
              )}
              {(type === 'PostCall' || type === 'P1') && showSentiments && (
                <Tabs.Trigger className="cursor-pointer" value="sentiment">
                  {t('knowledge_assist.sentiment')}
                </Tabs.Trigger>
              )}
            </Tabs.List>
            
            <Button 
              size="1" 
              variant="outline"
              className="cursor-pointer"
              onClick={handleExportAll}
              disabled={loading}
            >
              <DownloadIcon />
              {t('knowledge_assist.exportAll')}
            </Button>
          </Flex>
        </Box>

        <Tabs.Content
          value="transcript"
          className="flex-grow overflow-y-auto bg-[var(--color-background)]"
        >
          <PostCallTranscript transcript={sendTranscript} loading={loading} />
        </Tabs.Content>
        <Tabs.Content
          value="summary"
          className="flex-grow overflow-y-auto bg-[var(--color-background)]"
        >
          <PostCallSummary summary={summary} loading={loading} agentName={agentName || "Knowledge Assist"} meetingId={''}/>
        </Tabs.Content>
        <Tabs.Content
          value="keyWords"
          className="flex-grow overflow-y-auto bg-[var(--color-background)]"
        >
          {
            type === 'KnowledgeAssist' ? (
              <PostCallKeywords meetingId={meetingId} agentName={"Knowledge Assist"}/>
            ) : <PostCallEntities entity={entity} loading={loading} agentName={agentName} />
          }

        </Tabs.Content>

        {/* {type === 'KnowledgeAssist' && ( */}
        <Tabs.Content
          value="createKB"
          className="flex-grow overflow-y-auto bg-[var(--color-background)]"
        >
          <CreateKBTabView
            meetingId={meetingId}
            summary={summary}
            transcript={transcript}
            postcallTopics={postcallTopics}
            isLoadingPostcallTopics={isLoadingPostcallTopics}
            onUpdatePostcallTopics={handleUpdatePostcallTopics}
          />
        </Tabs.Content>
        {/* )} */}

        {(type === 'PostCall' || type === 'P1') && showSentiments && (
          <Tabs.Content
            value="sentiment"
            className="flex-grow overflow-y-auto bg-[var(--color-background)]"
          >
            <PostCallSentiments sentiment={sentiment} loading={loading} agenName={agentName} callerName={callerName}/>
          </Tabs.Content>
        )}
      </Tabs.Root>
    </Flex>
  );
}

export default PostCallPanel;