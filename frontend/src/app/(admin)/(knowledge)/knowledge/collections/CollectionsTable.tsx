import React from 'react';
import {
  Text, Table, Flex, IconButton, Button, Badge,
} from '@radix-ui/themes';
import { Pencil1Icon, TrashIcon, FileIcon } from '@radix-ui/react-icons';

interface TableProps {
  isLoading: boolean;
  error: string | null;
  kbCollections?: any[];
}

export function CollectionsTable({
  isLoading,
  error,
  kbCollections,
}: TableProps) {
  if (isLoading) return <Text>Loading KB collections...</Text>;
  if (error) return <Text color="red">{error}</Text>;

  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Collections</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Created on</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Document Count</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {kbCollections?.map((item) => (
          <Table.Row key={item.sys_id}>
            <Table.Cell>
              <Flex align="center" style={{ minHeight: '40px' }}>
                {item.title || item.name}
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Flex align="center" style={{ minHeight: '40px' }}>
                {new Date(item.sys_created_on).toLocaleDateString()}
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Flex align="center" style={{ minHeight: '40px' }}>
                {item.document_count || 'N/A'}
                {' '}
                documents
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Flex align="center" gap="2" style={{ minHeight: '40px' }}>
                <IconButton size="1" variant="ghost">
                  <Pencil1Icon />
                </IconButton>
                <IconButton size="1" variant="ghost">
                  <TrashIcon />
                </IconButton>
              </Flex>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
