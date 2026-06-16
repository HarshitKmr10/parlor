'use client';

import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Tabs,
  Text,
  Dialog,
  Flex,
  ScrollArea,
} from '@radix-ui/themes';
import { ChevronLeft, BookOpen, PlayCircle } from 'lucide-react';
import TrainAssistChat from 'components/chat/TrainAssistChat';
import ReactMarkdown from 'react-markdown';
import withAuth from 'components/withAuth';
import Topic from './Topic';
import TopicContent from './TopicContent';

type ChatContext = {
  category: string;
  module: string;
  chat_type: string;
  kb?: string;
};

type ContentProps = {
  onKBClick: (kb: string) => void;
  onMarkdownClick: (kb: string) => void;
};

function Dashboard() {
  const [chatContext, setChatContext] = useState<ChatContext>({
    category: 'Software',
    module: 'Software Configuration Issues',
    chat_type: 'quiz',
  });
  const chatRef = useRef<{
    sendMessage:(message: string, context: ChatContext) => void;
  } | null>(null);

  const [isMarkdownOpen, setIsMarkdownOpen] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const [activeTab, setActiveTab] = useState('Software Configuration Issues');

  const topics = [
    'Software Configuration Issues',
    'Application Installation Failures',
    'Troubleshooting Software Crashes',
    'Patch and Update Failures',
    'License Activation and Validation',
    'Slow Software Performance',
    'Misconceptions about Performance',
  ];

  const handleQuizClick = (topic: string) => {
    const newContext = {
      category: 'Software',
      module: topic,
      chat_type: 'quiz',
    };
    setChatContext(newContext);
    chatRef.current?.sendMessage(`Start a quiz on ${topic}`, newContext);
  };

  const handleSimulationClick = (topic: string) => {
    const newContext = {
      category: 'Software',
      module: topic,
      chat_type: 'simulation',
    };
    setChatContext(newContext);
    chatRef.current?.sendMessage(`Start a simulation on ${topic}`, newContext);
  };

  const handleKBClick = (kbArticleNumber: string) => {
    const newContext = {
      category: 'Software',
      module: 'Software Configuration Issues',
      chat_type: 'kb',
      kb: kbArticleNumber,
    };
    setChatContext(newContext);
    chatRef.current?.sendMessage(
      `Tell me about the knowledge base article ${kbArticleNumber}`,
      newContext,
    );
  };

  const handleMarkdownClick = (kbArticleNumber: string) => {
    const dummyMarkdown = `
# ${kbArticleNumber}

## Overview

This is a sample knowledge base article for ${kbArticleNumber}.

### Key Points

1. First important point
2. Second crucial detail
3. Third significant aspect

## Further Reading

- [Link 1](#)
- [Link 2](#)
- [Link 3](#)
    `;
    setMarkdownContent(dummyMarkdown);
    setIsMarkdownOpen(true);
  };

  const handleTopicClick = (topic: string) => {
    setActiveTab(topic);
  };

  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Text size="4" weight="medium">
            Train Assist
          </Text>
        </Flex>
      </Box>
      <Flex dir="col" className="h-full  overflow-y-auto">
        {/* Left Sidebar */}
        <Box className="w-64 bg-white border-r flex-col">
          <Box className="p-4">
            <Tabs.Root defaultValue="topics" className="flex flex-col h-full">
              <Tabs.List>
                <Tabs.Trigger value="topics">
                  <Text size="1">Topics</Text>
                </Tabs.Trigger>
                <Tabs.Trigger value="incidents">
                  <Text size="1">Incidents</Text>
                </Tabs.Trigger>
              </Tabs.List>
              <Box className="flex-grow overflow-auto">
                <Tabs.Content value="topics" className="h-full">
                  <Box className="mt-4">
                    <Flex direction="column" gap="2">
                      {topics.map((topic) => (
                        <Topic
                          key={topic}
                          topic={topic}
                          activeTab={activeTab}
                          onTopicClick={handleTopicClick}
                        />
                      ))}
                    </Flex>
                  </Box>
                </Tabs.Content>
                <Tabs.Content value="incidents" className="h-full">
                  <Text color="gray" size="1" className="mt-4">
                    No top incidents to display.
                  </Text>
                </Tabs.Content>
              </Box>
            </Tabs.Root>
          </Box>
        </Box>

        {/* Main Content */}
        <Flex direction="column" className="flex-1 overflow-hidden">
          {/* Breadcrumb */}
          <Flex align="center" className="p-4 text-sm text-gray-600 border-b">
            <Button variant="ghost" className="mr-2">
              <a href="/train-assist" className="flex items-center">
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span>Back</span>
              </a>
            </Button>
          </Flex>

          <Box className="p-6 overflow-auto">
            <Tabs.Root value={activeTab} className="w-full">
              <Tabs.List className="hidden">
                {topics.map((topic) => (
                  <Tabs.Trigger key={topic} value={topic}>
                    {topic}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              {topics.map((topic) => (
                <TopicContent
                  key={topic}
                  topic={topic}
                  onQuizClick={handleQuizClick}
                  onSimulationClick={handleSimulationClick}
                  onKBClick={handleKBClick}
                  onMarkdownClick={handleMarkdownClick}
                />
              ))}
            </Tabs.Root>
          </Box>
          {/* </ScrollArea> */}
        </Flex>

        {/* Right Sidebar */}
        <Box className="w-[36rem] bg-white border-l flex-col">
          <TrainAssistChat initialContext={chatContext} ref={chatRef} />
          {' '}
        </Box>

        {/* Markdown Modal */}
        <Dialog.Root open={isMarkdownOpen} onOpenChange={setIsMarkdownOpen}>
          <Dialog.Content style={{ maxWidth: '48rem', maxHeight: '80vh' }}>
            <Dialog.Title>Create New Knowledge Article</Dialog.Title>
            <ScrollArea style={{ height: 'calc(80vh - 80px)' }}>
              <ReactMarkdown>{markdownContent.trim()}</ReactMarkdown>
            </ScrollArea>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>
    </Flex>
  );
}

export default withAuth(Dashboard);
