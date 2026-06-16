// UsersOverview.tsx
import React, { useState } from 'react';
import { CaretSortIcon, Pencil1Icon } from '@radix-ui/react-icons';
import {
  Table,
  Flex,
  Text,
  Dialog,
  Button,
} from '@radix-ui/themes';
import CustomAvatar from 'components/CustomAvatar';
import Spinner from 'components/spinner/spinner';
import { useGlobalContext } from 'contexts/store';
import { User } from 'api/user';
import { EmailCell, DateCell, ColumnHeader } from './UserTableComponents';
import UpdateUserInfo2 from '../new-user/UpdateUserInfo2';
import { useTranslation } from 'react-i18next';
import RolesDisplay, { AssignedRole } from 'components/users/RolesDisplay';

interface Agent {
  name: string[];
  email: string;
  date: string;
  teams: string[];
  platform: {
    id: string;
    profile_type: string;
    profile_username: string;
  }[];
  id: string;
  role?: string;
  assigned_roles?: AssignedRole[];
}

interface Column {
  header: string;
  accessor: string;
  cell?: (value: any) => JSX.Element;
}

interface UsersOverviewProps {
  tableData: Agent[];
  refreshUserData: () => void;
  columns: Column[];
}

function UserNameCell({ info }: { info: any }) {
  const [name] = info.getValue();
  const fullName = `${name}`;
  return (
    <Flex align="center" gap="3">
      <CustomAvatar alt={fullName} src={null} name={fullName} />
      <Text weight="medium">{fullName}</Text>
    </Flex>
  );
}

function UsersOverview({
  tableData,
  refreshUserData,
  columns,
}: UsersOverviewProps) {
  const { t } = useTranslation();
  const [sortColumn, setSortColumn] = useState<keyof Agent | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedUser, setSelectedUser] = useState<Agent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useGlobalContext();

  const deleteUser = async (userId: string) => {
    setIsDeleting(true);
    try {
      await User.DeleteUser(userId, user);
      await refreshUserData();
    } catch (error) {
      console.error('Error deleting user:', error);
    } finally {
      setIsDeleting(false);
      setSelectedUser(null);
    }
  };

  function ActionCell({ clickedUser }: { clickedUser: Agent }) {
    return (
      <Flex align="center" className="h-full w-full space-x-2">
        <Dialog.Root>
          <Dialog.Trigger>
            <Button size="1" variant="solid" className="cursor-pointer">
              <Pencil1Icon />
              {t('admin_panel.edit')}
            </Button>
          </Dialog.Trigger>
          <Dialog.Content>
            {isUpdating ? (
              <Spinner />
            ) : (
              <UpdateUserInfo2
                setIsLoading={setIsUpdating}
                selectedUser={clickedUser}
                onUpdateComplete={() => {
                  setSelectedUser(null);
                  refreshUserData();
                }}
              />
            )}
          </Dialog.Content>
        </Dialog.Root>
        <Dialog.Root>
          <Dialog.Trigger>
            <Button size="1" variant="outline" className="cursor-pointer">
              {t('admin_panel.delete')}
            </Button>
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>{t('admin_panel.confirmUserDeletion')}</Dialog.Title>
            <Dialog.Description>
              {t('admin_panel.areYouSureDeleteUser')}
              <br />
              {t('admin_panel.name')}:
              {' '}
              {clickedUser.name[0]}
              <br />
              {t('admin_panel.email')}:
              {' '}
              {clickedUser.email}
            </Dialog.Description>
            <Flex justify="end" gap="3" mt="4">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  {t('admin_panel.cancel')}
                </Button>
              </Dialog.Close>
              <Dialog.Close>
                <Button
                  color="red"
                  onClick={() => deleteUser(clickedUser.id)}
                  disabled={isDeleting}
                >
                  {isDeleting ? t('admin_panel.deleting') : t('admin_panel.deleteUser')}
                </Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>
    );
  }

  const sortData = (
    data: Agent[],
    column: keyof Agent | null,
    direction: 'asc' | 'desc',
  ) => {
    if (!column) return data;
    return [...data].sort((a, b) => {
      if (a[column] < b[column]) return direction === 'asc' ? -1 : 1;
      if (a[column] > b[column]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (column: keyof Agent) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = sortData(tableData, sortColumn, sortDirection);

  return (
    <Table.Root className="w-full">
      <Table.Header className="w-full">
        <Table.Row className="w-full">
          <Table.ColumnHeaderCell
            className="w-[25%]"
            onClick={() => handleSort('name')}
          >
            <Flex align="center" gap="2">
              <ColumnHeader title={t('admin_panel.userName')} />
              <CaretSortIcon />
            </Flex>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            className="w-[25%]"
            onClick={() => handleSort('email')}
          >
            <Flex align="center" gap="2">
              <ColumnHeader title={t('admin_panel.email')} />
              <CaretSortIcon />
            </Flex>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className="w-[20%]">
            <Flex align="center" gap="2">
              <ColumnHeader title={t('admin_panel.roles')} />
            </Flex>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            className="w-[15%]"
            onClick={() => handleSort('date')}
          >
            <Flex align="center" gap="2">
              <ColumnHeader title={t('admin_panel.joinDate')} />
              <CaretSortIcon />
            </Flex>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className="w-[15%]">
            <ColumnHeader title={t('admin_panel.actions')} />
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {sortedData.map((agent) => (
          <Table.Row key={agent.email}>
            <Table.Cell className="w-[25%]">
              <UserNameCell info={{ getValue: () => agent.name }} />
            </Table.Cell>
            <Table.Cell className="w-[25%]">
              <EmailCell info={{ getValue: () => agent.email }} />
            </Table.Cell>
            <Table.Cell className="w-[20%]">
              <RolesDisplay roles={agent.assigned_roles || []} />
            </Table.Cell>
            <Table.Cell className="w-[15%]">
              <DateCell info={{ getValue: () => agent.date }} />
            </Table.Cell>
            <Table.Cell className="w-[15%]">
              <ActionCell clickedUser={agent} />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

export default UsersOverview;
