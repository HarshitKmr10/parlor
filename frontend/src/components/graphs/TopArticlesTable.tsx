'use client';

import React from 'react';
import {
  Box,
  Text,
  Table,
  Button,
  Tooltip,
  IconButton,
  Flex,
} from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';

interface Article {
  name: string;
  category: string;
  status: string;
  score: string;
  action: string;
}

interface TopArticlesProps {
  articles: Article[];
}

export function TopArticles({ articles }: TopArticlesProps) {
  return (
    <Box className="w-full  bg-white p-4 rounded-lg">
      <Flex align="center" gap="2" mb="4">
        <Text size="5" weight="medium" color="gray">
          Top Articles
        </Text>
        <Tooltip content="Most used articles based on incident analysis.">
          <IconButton size="1" variant="ghost">
            <InfoCircledIcon />
          </IconButton>
        </Tooltip>
      </Flex>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Article Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Category</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Score</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {articles.map((article, index) => (
            <Table.Row key={index}>
              <Table.Cell>{article.name}</Table.Cell>
              <Table.Cell>{article.category}</Table.Cell>
              <Table.Cell>{article.status}</Table.Cell>
              <Table.Cell>{article.score}</Table.Cell>
              <Table.Cell>
                <Button variant="ghost" size="1" className="underline">
                  {article.action}
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
