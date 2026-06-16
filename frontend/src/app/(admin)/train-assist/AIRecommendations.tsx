import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Flex, Text, Card, Button, Badge,
} from '@radix-ui/themes';
import { MoreHorizontal } from 'lucide-react';

interface AIRecommendationsProps {
  recommendations: any;
}

function AIRecommendations({ recommendations }: AIRecommendationsProps) {
  const { t } = useTranslation();
  return (
    <>
      <Flex align="center" mb="4">
        <Text size="5" weight="medium" mr="2" color="gray">
          {t('train_assist.aiRecommendations')}
        </Text>
        <Badge variant="soft">{recommendations.length}</Badge>
      </Flex>
      {recommendations.map((item, index) => (
        <Card key={index} className="mb-2 p-4">
          <Flex justify="between" align="center">
            <Flex className="flex-1 flex-col mr-2">
              <Text weight="bold" size="2">
                {item.title}
              </Text>
              <Text color="gray" size="3">
                {item.subtitle}
              </Text>
              <Text size="1">{item.description}</Text>
            </Flex>
            <Button variant="ghost" size="1">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </Flex>
        </Card>
      ))}
    </>
  );
}

export default AIRecommendations;
