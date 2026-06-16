import { Flex, Text } from '@radix-ui/themes';
import PieChartCircleIcon from 'components/icons/PieChartCircleIcon';
import { FC } from 'react';

interface KBArticle {
  title: string;
  count: number;
}

interface TopUsedKBsProps {
  articles: KBArticle[];
  className?: string;
}

const TopUsedKBs: FC<TopUsedKBsProps> = ({ articles, className }) => (
    <Flex direction="column" gap="2" className={`bg-white p-6 rounded-lg ${className}`}>
        <Text size="4" weight="medium" className="mb-2">Top Used KBs</Text>
        <Flex direction="row" gap="2" align="center" justify="between">
          <Text size="2" color="gray">Article Name</Text>
          <Text size="2" color="gray">Usage Count</Text>
        </Flex>
        <Flex direction="column" gap="2" className="flex-1">
          {articles.map((article, index) => (
            <Flex key={index} direction="row" gap="6" align="center" justify="between">
              <Flex align="center" gap="2" className="overflow-hidden">
                <PieChartCircleIcon className="shrink-0" color="#5B5BD6" />
                <Text size="2" truncate>{article.title}</Text>
              </Flex>
              <Text size="2">{article.count}</Text>
            </Flex>
          ))}
        </Flex>
    </Flex>
);

export default TopUsedKBs;
