'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, 
  Flex, 
  Text, 
  Button, 
  Table, 
  IconButton,
  AlertDialog
} from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { API_ENDPOINTS } from 'constants/dashboard';
import { toast } from 'react-toastify';
import useUserRoles from '@/hooks/useUserRoles';
import { Pencil, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface Tower {
  id: string;
  name: string;
  description?: string;
  org_id: string;
  created_at: string;
  updated_at: string;
}

function TagsManagement() {
  const { t } = useTranslation();
  const router = useRouter();
  const [towers, setTowers] = useState<Tower[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTower, setSelectedTower] = useState<Tower | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const roles = useUserRoles();

  const fetchTowers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await serviceDeskInstance.get(API_ENDPOINTS.TAGS);
      if (response.data.success) {
        setTowers(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching towers:', error);
      toast.error(t('admin_panel.failedToFetchTowers'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTowers();
  }, [fetchTowers]);

  const handleCreateTower = () => {
    if (!roles.train_assist_admin) {
      toast.error(t('admin_panel.noPermissionToCreateTowers'));
      return;
    }
    router.push('/admin/towers/manage');
  };

  const handleEditTower = (tower: Tower) => {
    router.push(`/admin/towers/manage?id=${tower.id}`);
  };

  const handleDeleteTower = async () => {
    if (!selectedTower) return;

    if (!roles.train_assist_admin) {
      toast.error(t('admin_panel.noPermissionToDeleteTowers'));
      return;
    }

    try {
      setSubmitting(true);
      const response = await serviceDeskInstance.delete(`${API_ENDPOINTS.TAGS}/${selectedTower.id}`);

      if (response.data.success) {
        toast.success(t('admin_panel.towerDeletedSuccessfully'));
        setIsDeleteModalOpen(false);
        setSelectedTower(null);
        await fetchTowers();
      }
    } catch (error) {
      console.error('Error deleting tower:', error);
      toast.error(t('admin_panel.failedToDeleteTower'));
    } finally {
      setSubmitting(false);
    }
  };



  const openDeleteModal = (tower: Tower) => {
    if (!roles.train_assist_admin) {
      toast.error(t('admin_panel.noPermissionToDeleteTowers'));
      return;
    }
    setSelectedTower(tower);
    setIsDeleteModalOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box className="p-6">
      <Flex justify="between" align="center" className="mb-6">
        <Box>
          <Text size="6" weight="bold">{t('admin_panel.towerManagement')}</Text>
          <br />
          <Text size="2" color="gray" className="mt-1">
            {t('admin_panel.createAndManageTowers')}
          </Text>
        </Box>
        <Button 
          onClick={handleCreateTower}
          disabled={!roles.train_assist_admin}
        >
          <PlusIcon />
          {t('admin_panel.createTower')}
        </Button>
      </Flex>

      {loading ? (
        <Flex justify="center" align="center" className="h-64">
          <Text>{t('admin_panel.loadingTowers')}</Text>
        </Flex>
      ) : towers.length === 0 ? (
        <Flex direction="column" align="center" justify="center" className="h-64 border border-dashed border-[var(--gray-6)] rounded-lg">
          <Text size="4" color="gray" className="mb-2">{t('admin_panel.noTowersFound')}</Text>
          <Text size="2" color="gray" className="mb-4">{t('admin_panel.createYourFirstTower')}</Text>
          <Button 
            onClick={handleCreateTower}
            disabled={!roles.train_assist_admin}
          >
            <PlusIcon />
            {t('admin_panel.createTower')}
          </Button>
        </Flex>
      ) : (
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>{t('admin_panel.name')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t('admin_panel.created')}</Table.ColumnHeaderCell>
              {/* <Table.ColumnHeaderCell>Updated</Table.ColumnHeaderCell> */}
              <Table.ColumnHeaderCell>{t('admin_panel.actions')}</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {towers.map((tower) => (
              <Table.Row key={tower.id}>
                <Table.Cell>
                  <Text weight="medium">{tower.name}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {formatDate(tower.created_at)}
                  </Text>
                </Table.Cell>
                {/* <Table.Cell>
                  <Text size="2" color="gray">
                    {formatDate(tower.updated_at)}
                  </Text>
                </Table.Cell> */}
                <Table.Cell>
                  <Flex gap="4">
                    <IconButton
                      variant="ghost"
                      size="1"
                      onClick={() => handleEditTower(tower)}
                      className='cursor-pointer'
                    >
                      <Pencil height={16} width={16}/>
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      size="1"
                      color="red"
                      onClick={() => openDeleteModal(tower)}
                      className='cursor-pointer'
                      disabled={!roles.train_assist_admin}
                    >
                      <Trash height={16} width={16} />
                    </IconButton>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}



      {/* Delete Confirmation Modal */}
      <AlertDialog.Root open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialog.Content className="max-w-md">
          <AlertDialog.Title>{t('admin_panel.deleteTower')}</AlertDialog.Title>
          <AlertDialog.Description>
            {t('admin_panel.areYouSureDeleteTower', { name: selectedTower?.name })}
          </AlertDialog.Description>

          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                {t('admin_panel.cancel')}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button 
                color="red" 
                onClick={handleDeleteTower} 
                disabled={submitting || !roles.train_assist_admin}
              >
                {submitting ? t('admin_panel.deletingTower') : t('admin_panel.deleteTower')}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  );
}

export default TagsManagement; 