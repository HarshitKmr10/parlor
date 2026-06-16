import React from 'react';
import { Table, Checkbox, Spinner, Text, Flex } from '@radix-ui/themes';
import clsx from 'clsx';

const cellBaseClass = 'py-1.5 px-2 text-[11px] font-normal text-[#1C2024] align-middle';

export interface Column<T> {
  header: string | React.ReactNode;
  accessor: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  hideDivider?: boolean;
}

interface CompactTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  rowKey: (item: T) => string;
  selectable?: boolean;
  selectedRowIds?: Record<string, boolean>;
  onRowSelect?: (id: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  selectAllState?: boolean | 'indeterminate';
  actionsColumn?: (item: T) => React.ReactNode;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

function CompactTable<T>({
  data,
  columns,
  isLoading = false,
  rowKey,
  selectable = false,
  selectedRowIds,
  onRowSelect,
  onSelectAll,
  selectAllState = false,
  actionsColumn,
  emptyMessage = 'No data found.',
  onRowClick,
}: CompactTableProps<T>) {
  return (
    <Table.Root variant="surface" className="w-full shadow-none border-0" style={{ border: 'none', borderBottom: '1px solid rgb(218, 222, 236)' }}>
      <Table.Header>
        <Table.Row className="h-[30px] mx-4 py-[2px] border-0">
          {selectable && (
            <Table.ColumnHeaderCell className={`w-[2%] ${cellBaseClass} text-center border-0 shadow-none`}>
              <Checkbox
                checked={selectAllState}
                onCheckedChange={onSelectAll}
                className="cursor-pointer scale-90"
              />
            </Table.ColumnHeaderCell>
          )}
          {columns.map((col, idx) => (
            <Table.ColumnHeaderCell
              key={idx}
              className={clsx(col.width ?? 'w-auto', cellBaseClass, 'text-[11px] font-medium text-[#6B7280] border-0 shadow-none')}
              align={col.align}
            >
              {col.header}
            </Table.ColumnHeaderCell>
          ))}
          {actionsColumn && (
            <Table.ColumnHeaderCell className={`w-[10%] ${cellBaseClass} text-center border-0 shadow-none`}>
              Actions
            </Table.ColumnHeaderCell>
          )}
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {isLoading ? (
          <Table.Row className="border-0">
            <Table.Cell className="border-0" colSpan={columns.length + (selectable ? 1 : 0) + (actionsColumn ? 1 : 0)}>
              <Flex justify="center" py="3">
                <Spinner size="1" />
              </Flex>
            </Table.Cell>
          </Table.Row>
        ) : data.length === 0 ? (
          <Table.Row className="border-0">
            <Table.Cell className="border-0" colSpan={columns.length + (selectable ? 1 : 0) + (actionsColumn ? 1 : 0)}>
              <Text size="1" color="gray" align="center" className="py-3">
                {emptyMessage}
              </Text>
            </Table.Cell>
          </Table.Row>
        ) : (
          data.map((item) => (
            <Table.Row
              key={rowKey(item)}
              className="h-[30px] cursor-pointer hover:bg-gray-50 transition-colors border-0"
              onClick={() => onRowClick?.(item)}
            >
              {selectable && (
                <Table.Cell className={`w-[2%] ${cellBaseClass} text-center border-0`}>
                  <Checkbox
                    checked={selectedRowIds?.[rowKey(item)] ?? false}
                    onCheckedChange={(checked: boolean) => onRowSelect?.(rowKey(item), checked)}
                    className="cursor-pointer scale-90"
                    onClick={(e) => e.stopPropagation()}
                  />
                </Table.Cell>
              )}
              {columns.map((col, idx) => (
                <Table.Cell
                  key={idx}
                  className={clsx(cellBaseClass, col.width ?? 'w-auto', 'border-0 shadow-none')}
                  align={col.align}
                >
                  {(() => {
                    const raw = col.render ? col.render(item) : (item[col.accessor as keyof T] as unknown as React.ReactNode);
                    if (raw === null || raw === undefined) return '-';
                    if (typeof raw === 'string' && raw.trim().length === 0) return '-';
                    if (Array.isArray(raw) && raw.length === 0) return '-';
                    return raw as React.ReactNode;
                  })()}
                </Table.Cell>
              ))}
              {actionsColumn && (
                <Table.Cell className={`w-[10%] ${cellBaseClass} text-center border-0`}>
                  <div onClick={(e) => e.stopPropagation()}>
                    {actionsColumn(item)}
                  </div>
                </Table.Cell>
              )}
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
}

export default CompactTable;

