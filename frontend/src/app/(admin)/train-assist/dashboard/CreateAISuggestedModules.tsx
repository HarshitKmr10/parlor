import React from 'react';
import {
  Flex, Text, Card, Badge, Box,
} from '@radix-ui/themes';
import { MoreHorizontal, GraduationCap, Mail } from 'lucide-react';
import AISparkle from 'components/icons/AISparkle';

interface AISuggestedModulesProps {
  recommendations: any;
}

function CreateAISuggestedModules({
  recommendations,
}: AISuggestedModulesProps) {
  return (
    <>
      {/* Header */}
      <Flex align="center" my="4">
        <AISparkle />
        <Text size="5" weight="bold" color="iris" className="ml-2">
          Create AI Suggested Modules
        </Text>
        <Badge variant="soft" ml="2">
          {recommendations.length}
        </Badge>
      </Flex>

      {/* Module Cards */}
      {recommendations.map((item, index) => (
        <Box key={index} className="mb-3 p-4 rounded-lg bg-gray-50">
          <Flex justify="between" align="center">
            <Flex className="flex-1 flex-col mr-2">
              {/* Icon and Quiz Information */}
              <Flex align="center" mb="2">
                {item.type === 'quiz' && (
                  <GraduationCap className="text-yellow-500 mr-1" />
                )}
                {item.type === 'email' && (
                  <Mail className="text-yellow-500 mr-1" />
                )}
                <Text size="2" color="gray" weight="medium">
                  {item.quizzes}
                  {' '}
                  {item.quizzes > 1 ? 'quizzes' : 'quiz'}
                </Text>
              </Flex>

              {/* Module Title */}
              <Text weight="bold" size="3" mb="1">
                {item.title}
              </Text>

              {/* Module Description */}
              <Text size="2" color="gray">
                {item.description}
              </Text>
            </Flex>

            {/* More Options Button */}
            <Box>
              <MoreHorizontal className="h-4 w-4 text-gray-400" />
            </Box>
          </Flex>
        </Box>
      ))}
    </>
  );
}

export default CreateAISuggestedModules;
