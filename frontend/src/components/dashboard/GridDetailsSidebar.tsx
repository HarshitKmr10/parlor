'use client';

import { Box, Text, Flex, ScrollArea } from '@radix-ui/themes';
import { Cross1Icon, DownloadIcon } from '@radix-ui/react-icons';

interface TopicExample {
  text: string;
}

interface TopicData {
  name: string;
  issues: number;
  employees: number;
  ttr: number;
  examples?: TopicExample[];
}

interface GridDetailsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    title: string;
    totalEmployees: number;
    totalIssues: number;
    metrics: {
      issuesPerEmployee: number;
      timeToResolution: number;
      firstTouchResolution: number;
    };
    topics: TopicData[];
  };
}

export function GridDetailsSidebar({ isOpen, onClose, data }: GridDetailsSidebarProps) {
  if (!isOpen || !data) return null;

  return (
    <>
      {/* Backdrop */}
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 999,
        }}
        onClick={onClose}
      />

      {/* Sidebar */}
      <Box
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '400px',
          backgroundColor: 'var(--color-background)',
          borderLeft: '1px solid var(--gray-5)',
          zIndex: 1000,
          boxShadow: '-4px 0 8px rgba(0, 0, 0, 0.1)',
          animation: 'slideIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <Flex justify="between" align="center" p="4" style={{ borderBottom: '1px solid var(--gray-5)' }}>
          <Text size="5" weight="bold">{data.title}</Text>
          <Flex gap="2">
            <DownloadIcon style={{ cursor: 'pointer' }} />
            <Cross1Icon onClick={onClose} style={{ cursor: 'pointer' }} />
          </Flex>
        </Flex>

        {/* Summary */}
        <Box p="4" style={{ borderBottom: '1px solid var(--gray-5)' }}>
          <Text color="gray">
            {data.totalEmployees} employee(s) raised {data.totalIssues} issue(s) in this period.
          </Text>
        </Box>

        {/* Metrics */}
        <Flex p="4" gap="4" style={{ borderBottom: '1px solid var(--gray-5)' }}>
          <Box>
            <Text size="5" weight="bold">{data.metrics.issuesPerEmployee}</Text>
            <Text size="2" color="gray">Issues Per Employee</Text>
          </Box>
          <Box>
            <Text size="5" weight="bold">{data.metrics.timeToResolution} hr</Text>
            <Text size="2" color="gray">Time To Resolution</Text>
          </Box>
          <Box>
            <Text size="5" weight="bold">{data.metrics.firstTouchResolution}%</Text>
            <Text size="2" color="gray">First Touch Resolution</Text>
          </Box>
        </Flex>

        {/* Topics */}
        <Box p="4">
          <Text weight="bold" mb="2">TOP TOPICS</Text>
          <ScrollArea>
            {data.topics.map((topic, index) => (
              <Box 
                key={index} 
                mb="3"
                style={{
                  border: '1px solid var(--gray-5)',
                  borderRadius: 'var(--radius-2)',
                }}
              >
                <Flex p="3" justify="between" align="center">
                  <Text weight="bold">{topic.name}</Text>
                  <DownloadIcon style={{ cursor: 'pointer' }} />
                </Flex>
                <Box p="3" style={{ borderTop: '1px solid var(--gray-5)' }}>
                  <Flex gap="2" mb="2">
                    <Text color="blue">{topic.issues} issues</Text>
                    <Text color="gray">|</Text>
                    <Text color="gray">{topic.employees} employees</Text>
                    <Text color="gray">|</Text>
                    <Text color="gray">{topic.ttr} hr TTR</Text>
                  </Flex>
                  {topic.examples && (
                    <Box>
                      <Text weight="medium" mb="2">Topic Examples</Text>
                      {topic.examples.map((example, i) => (
                        <Text key={i} size="2" color="gray" mb="1">
                          {example.text}
                        </Text>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </ScrollArea>
        </Box>
      </Box>

      {/* Add CSS animation */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
} 