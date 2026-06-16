import React from 'react';
import {
  Table,
  Checkbox,
  Spinner,
  Text,
  Flex,
} from '@radix-ui/themes';
import clsx from 'clsx';

// Import the styling classes from TrainAssistConfig
const cellBaseClass = 'relative py-2.5 px-2 text-xs font-normal text-[#1C2024] align-middle';
const dividerSpan = 'absolute top-[8px] bottom-[8px] right-0 w-px bg-gray-200 content-[""]';

export interface Column<T> {
  header: string | React.ReactNode;
  accessor: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  hideDivider?: boolean;
}

interface CustomTableProps<T> {
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
  cursorPointer?: boolean; // Controls whether rows show cursor-pointer. Defaults to true.
}

function CustomTable<T>({
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
  cursorPointer = true,
}: CustomTableProps<T>) {

  console.log("cursor pointer", cursorPointer);

  return (
    <Table.Root variant="surface" className="w-full rounded-sm px-2">
      <Table.Header>
        <Table.Row className="h-[36px] px-[9px] py-[2px]">
          {selectable && (
            <Table.ColumnHeaderCell className={`w-[2%] ${cellBaseClass} text-center`}>
              <Checkbox
                checked={selectAllState}
                onCheckedChange={onSelectAll}
                className="cursor-pointer"
              />
              <span className={dividerSpan} />
            </Table.ColumnHeaderCell>
          )}
          {columns.map((col, idx) => (
            <Table.ColumnHeaderCell
              key={idx}
              className={clsx(col.width ?? 'w-auto', cellBaseClass, 'text-xs font-semibold')}
              align={col.align}
            >
              {col.header}
              {!col.hideDivider && <span className={dividerSpan} />}
            </Table.ColumnHeaderCell>
          ))}
          {actionsColumn && (
            <Table.ColumnHeaderCell className={`w-[10%] ${cellBaseClass} text-center`}>
              Actions
            </Table.ColumnHeaderCell>
          )}
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {isLoading ? (
          <Table.Row>
            <Table.Cell colSpan={columns.length + (selectable ? 1 : 0) + (actionsColumn ? 1 : 0)}>
              <Flex justify="center" py="4">
                <Spinner />
              </Flex>
            </Table.Cell>
          </Table.Row>
        ) : data.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={columns.length + (selectable ? 1 : 0) + (actionsColumn ? 1 : 0)}>
              <Text size="2" color="gray" align="center" className="py-4">
                {emptyMessage}
              </Text>
            </Table.Cell>
          </Table.Row>
        ) : (
          data.map((item) => (
            <Table.Row 
              key={rowKey(item)} 
              className={clsx(
                "h-[36px] hover:bg-coolGrey-50",
                cursorPointer && "cursor-pointer"
              )}
              onClick={() => onRowClick?.(item)}
            >
              {selectable && (
                <Table.Cell className={`w-[2%] ${cellBaseClass} text-center`}>
                  <Checkbox
                    checked={selectedRowIds?.[rowKey(item)] ?? false}
                    onCheckedChange={(checked: boolean) => onRowSelect?.(rowKey(item), checked)}
                    className="cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className={dividerSpan} />
                </Table.Cell>
              )}
              {columns.map((col, idx) => (
                <Table.Cell
                  key={idx}
                  className={clsx(cellBaseClass, col.width ?? 'w-auto')}
                  align={col.align}
                >
                  {col.render ? col.render(item) : String(item[col.accessor as keyof T] ?? '-')}
                  {!col.hideDivider && <span className={dividerSpan} />}
                </Table.Cell>
              ))}
              {actionsColumn && (
                <Table.Cell className={`w-[10%] ${cellBaseClass} text-center`}>
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

export default CustomTable;