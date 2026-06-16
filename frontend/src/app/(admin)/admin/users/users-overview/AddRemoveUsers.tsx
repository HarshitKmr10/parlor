import React from 'react';
import {
  Text, Table, Flex, Button, Badge, Avatar,
} from '@radix-ui/themes';
import { FileIcon } from '@radix-ui/react-icons';
import { useTranslation } from 'react-i18next';

interface TableProps {
  isLoading: boolean;
  error: string | null;
  kbArticles?: any[];
}

export function AddRemoveUsers({
  isLoading,
  error,
  kbArticles,
}: TableProps) {
  const { t } = useTranslation();
  if (isLoading) return <Text>{t('admin_panel.loadingKBArticles')}</Text>;
  if (error) return <Text color="red">{error}</Text>;

  const handleArticleClick = (accessUrl) => {
    window.open(accessUrl, '_blank');
  };

  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>{t('admin_panel.kbArticles')}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{t('admin_panel.category')}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{t('admin_panel.createdAt')}</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {kbArticles?.map((article) => (
          <Table.Row key={article.id}>
            <Table.Cell>
              <Flex align="center" gap="2" style={{ minHeight: '40px' }}>
                <Avatar
                  size="2"
                  variant="solid"
                  fallback={<FileIcon />}
                  radius="medium"
                />
                <Flex direction="column" justify="center">
                  <Text
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => handleArticleClick(article.access_url)}
                  >
                    {article.name}
                  </Text>
                </Flex>
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Flex align="center" style={{ minHeight: '40px' }}>
                {article.category}
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Flex align="center" style={{ minHeight: '40px' }}>
                {new Date(article.created_at).toLocaleDateString()}
              </Flex>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}