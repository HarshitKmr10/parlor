import React from 'react';
import type { ArticleData } from 'types/dashboard';
import {
  Box, Text, Table, Flex, Badge,
} from '@radix-ui/themes';
import ProgressCircle from './ProgressCircle';

const truncateId = (id: string) => {
  if (!id) return '';
  if (id.length <= 12) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
};

const SimilarDocumentsTable: React.FC<{
  articles: ArticleData[];
  onArticleClick: (url: string) => void;
}> = React.memo(({ articles, onArticleClick }) => (
  <Box>
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>
            <Text size="2" weight="medium" color="gray">
              Article Number
            </Text>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>
            <Text size="2" weight="medium" color="gray">
              Article Name
            </Text>
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {articles.map((article) => (
          <Table.Row
            key={article.id}
            className="hover:bg-gray-50 cursor-pointer"
            onClick={() => onArticleClick(article.access_url)}
          >
            <Table.Cell>
              <Flex align="center" gap="2">
                <Badge size="2" color="gray" variant="outline" radius="medium">
                  <Flex align="center" gap="1">
                    {/* <PiTicketFill className="text-[var(--iris-11)]" size={16} /> */}
                    <ProgressCircle progress={article.score * 10} size={16} />
                    {/* {formatKbNumber(article.name)} */}
                    {/* {truncateId(article.id)} */}
                    {article.number}
                  </Flex>
                </Badge>
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Text size="2" className="line-clamp-1">
                {article.name}
              </Text>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  </Box>
));

export default SimilarDocumentsTable;
