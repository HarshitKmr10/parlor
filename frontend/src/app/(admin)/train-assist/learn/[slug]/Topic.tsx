import React from 'react';
import { Flex, Text, Box } from '@radix-ui/themes';
import { ChevronRight } from 'lucide-react';

type TopicProps = {
  topic: string;
  activeTab: string;
  onTopicClick: (topic: string) => void;
};

function Topic({ topic, activeTab, onTopicClick }: TopicProps) {
  return (
    <Flex
      align="center"
      className={`cursor-pointer ${
        activeTab === topic
          ? 'text-[var(--accent-11)] font-medium'
          : 'text-gray-700'
      }`}
      onClick={() => onTopicClick(topic)}
    >
      {activeTab === topic ? (
        <ChevronRight className="w-4 h-4 mr-2" />
      ) : (
        <Box className="w-4 h-4 mr-2" />
      )}
      <Text>{topic}</Text>
    </Flex>
  );
}

export default Topic;
