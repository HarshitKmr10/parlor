import React, { useState, useCallback, useEffect } from 'react';
import { Box, Tabs } from '@radix-ui/themes';
import { KBArticles } from './KBArticles';
import AgentsList from './AgentsList';
import ModuleSettings from './ModuleSettings';
import { AnalyticsTab } from './AnalyticsTab';
import TagsManagement from './TagsManagement';
import { useRouter } from 'next/navigation';
import useUserRoles from 'hooks/useUserRoles';
import { useGlobalContext } from 'contexts/store';
import { useTranslation } from 'react-i18next';

enum TabStateType {
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  KB_ARTICLES = 'KB_ARTICLES',
  MODULE_SETTINGS = 'MODULE_SETTINGS',
  ANALYTICS = 'ANALYTICS',
  TAGS = 'TAGS',
}

interface KBCollection {
  id: string;
  name: string;
  source: string;
  source_config: any;
  document_count?: number;
  count?: number;
}

interface KBArticle {
  id: string;
  name: string;
  knowledgebase_collection_id: string;
  created_at: string;
  access_url: string;
  updated_at: string;
}

interface UserManagementTabsProps {
  isLoading: boolean;
  error: string | null;
  kbCollections: KBCollection[];
  kbArticles: KBArticle[];
  selectedCollection: { id: string; name: string; source: string } | null;
  onCollectionSelect: (collection: { id: string; name: string; source: string }) => void;
  deduplicatedArticles?: KBArticle[];
  onRefreshCollections: () => Promise<void>;
  isLoadingArticles: boolean;
}

function UserManagementTabs({
  isLoading,
  error,
  kbCollections,
  kbArticles,
  selectedCollection,
  onCollectionSelect,
  deduplicatedArticles = [],
  onRefreshCollections,
  isLoadingArticles,
}: UserManagementTabsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const roles = useUserRoles();
  const { organization } = useGlobalContext();

  // Determine if any dashboard module is enabled
  let showAnalytics = false;
  if (organization) {
    try {
      const config = JSON.parse(organization.config);
      const modules = config.Modules || {};
      showAnalytics =
        modules.agent_assist?.enabled ||
        modules.chat_virtual_agent?.enabled ||
        modules.train_assist?.enabled ||
        modules.voice_virtual_agent?.enabled;
    } catch (e) {
      showAnalytics = false;
    }
  }

  // Define role-based access control
  const canAccessUserManagement = roles.platform_admin;

  const canAccessModuleFeatures =
    roles.agent_assist_admin || roles.train_assist_admin || roles.knowledge_assist_admin;

  // KB Articles access - includes module admins and tag leads
  const canAccessKBArticles = canAccessModuleFeatures || roles.is_tag_lead;

  // Analytics access - includes module admins and tag leads
  const canAccessAnalytics = canAccessModuleFeatures || roles.is_tag_lead;

  // Tags tab is only for train assist admin and tag leads
  const canAccessTags = roles.train_assist_admin || roles.is_tag_lead;

  // Check if user has any access at all
  const hasAnyAccess =
    canAccessUserManagement ||
    canAccessKBArticles ||
    canAccessModuleFeatures ||
    canAccessAnalytics ||
    canAccessTags;

  // Helper function to get the first accessible tab
  const getFirstAccessibleTab = (): TabStateType => {
    if (canAccessUserManagement) {
      return TabStateType.USER_MANAGEMENT;
    }
    if (canAccessKBArticles) {
      return TabStateType.KB_ARTICLES;
    }
    if (canAccessTags) {
      return TabStateType.TAGS;
    }
    // Fallback - should not happen in normal circumstances
    return TabStateType.USER_MANAGEMENT;
  };

  const [selectedTab, setSelectedTab] = useState<TabStateType>(getFirstAccessibleTab());

  const handleNewCollection = () => {
    console.log('Creating new collection');
  };

  const handleEditCollection = (collectionId: string) => {
    console.log('Editing collection:', collectionId);
  };

  const handleDeleteCollection = (collectionId: string) => {
    console.log('Deleting collection:', collectionId);
  };

  const handleAddDocument = () => {
    console.log('Adding new document');
  };

  const handleCollectionCreated = useCallback(async () => {
    await onRefreshCollections();
  }, [onRefreshCollections]);

  const normalizeHashToEnum = useCallback((hash: string): TabStateType => {
    const normalizedHash = hash.replace('#', '').toUpperCase();
    switch (normalizedHash) {
      case 'USER_MANAGEMENT':
        return TabStateType.USER_MANAGEMENT;
      case 'KB_ARTICLES':
        return TabStateType.KB_ARTICLES;
      case 'MODULE_SETTINGS':
        return TabStateType.MODULE_SETTINGS;
      case 'ANALYTICS':
        return TabStateType.ANALYTICS;
      case 'TAGS':
        return TabStateType.TAGS;
      default:
        return TabStateType.USER_MANAGEMENT;
    }
  }, []);

  useEffect(() => {
    const hash = window?.location.hash.replace('#', '');
    const tabFromHash = normalizeHashToEnum(hash);

    // Check if user can access the requested tab
    const canAccessTab = (tab: TabStateType): boolean => {
      switch (tab) {
        case TabStateType.USER_MANAGEMENT:
          return canAccessUserManagement;
        case TabStateType.KB_ARTICLES:
          return canAccessKBArticles;
        case TabStateType.MODULE_SETTINGS:
          return canAccessModuleFeatures;
        case TabStateType.ANALYTICS:
          return canAccessAnalytics;
        case TabStateType.TAGS:
          return canAccessTags;
        default:
          return false;
      }
    };

    // Use requested tab if accessible, otherwise use first accessible tab
    const validTab = canAccessTab(tabFromHash) ? tabFromHash : getFirstAccessibleTab();

    setSelectedTab(validTab);
  }, [
    canAccessUserManagement,
    canAccessKBArticles,
    canAccessModuleFeatures,
    canAccessAnalytics,
    canAccessTags,
    normalizeHashToEnum,
  ]);

  const handleTabClick = (tab: TabStateType) => {
    // Safety check - ensure user can access the tab
    const canAccessTab = (tabToCheck: TabStateType): boolean => {
      switch (tabToCheck) {
        case TabStateType.USER_MANAGEMENT:
          return canAccessUserManagement;
        case TabStateType.KB_ARTICLES:
          return canAccessKBArticles;
        case TabStateType.MODULE_SETTINGS:
          return canAccessModuleFeatures;
        case TabStateType.ANALYTICS:
          return canAccessAnalytics;
        case TabStateType.TAGS:
          return canAccessTags;
        default:
          return false;
      }
    };

    if (!canAccessTab(tab)) {
      console.warn(`User attempted to access unauthorized tab: ${tab}`);
      return;
    }

    setSelectedTab(tab);
    router.push(`#${tab.toLowerCase()}`);
  };

  return (
    <>
      {!hasAnyAccess ? (
        <Box className="p-8 text-center">
          <h2 className="mb-4 text-xl font-semibold text-gray-600">{t('admin_panel.accessRestricted')}</h2>
          <p className="text-gray-500">
            {t('admin_panel.noPermissionToAccess')}
          </p>
        </Box>
      ) : (
        <Tabs.Root value={selectedTab} onValueChange={handleTabClick} className="w-full">
          <Box className="sticky top-0 z-10 border-b border-[var(--gray-6)] bg-white">
            <Tabs.List className="px-4">
              {canAccessUserManagement && (
                <Tabs.Trigger value={TabStateType.USER_MANAGEMENT}>{t('admin_panel.userManagement')}</Tabs.Trigger>
              )}
              {canAccessKBArticles && (
                <Tabs.Trigger value={TabStateType.KB_ARTICLES}>{t('admin_panel.kbArticles')}</Tabs.Trigger>
              )}
              {canAccessModuleFeatures && (
                <Tabs.Trigger value={TabStateType.MODULE_SETTINGS}>{t('admin_panel.moduleSettings')}</Tabs.Trigger>
              )}
              {canAccessAnalytics && showAnalytics && (
                <Tabs.Trigger value={TabStateType.ANALYTICS}>{t('admin_panel.analytics')}</Tabs.Trigger>
              )}
              {canAccessTags && <Tabs.Trigger value={TabStateType.TAGS}>{t('admin_panel.towers')}</Tabs.Trigger>}
            </Tabs.List>
          </Box>

          <Box>
            {canAccessUserManagement && (
              <Tabs.Content value={TabStateType.USER_MANAGEMENT} className="p-4 outline-none">
                <AgentsList />
              </Tabs.Content>
            )}

            {canAccessKBArticles && (
              <Tabs.Content value={TabStateType.KB_ARTICLES} className="outline-none">
                <KBArticles
                  isLoading={isLoading}
                  error={error}
                  kbCollections={kbCollections}
                  kbArticles={kbArticles}
                  selectedCollection={selectedCollection}
                  onCollectionSelect={onCollectionSelect}
                  onNewCollection={handleNewCollection}
                  onEditCollection={handleEditCollection}
                  onCollectionCreated={handleCollectionCreated}
                  onDeleteCollection={handleDeleteCollection}
                  onAddDocument={handleAddDocument}
                  isLoadingArticles={isLoadingArticles}
                />
              </Tabs.Content>
            )}

            {canAccessModuleFeatures && (
              <Tabs.Content value={TabStateType.MODULE_SETTINGS} className="outline-none">
                <ModuleSettings />
              </Tabs.Content>
            )}

            {canAccessAnalytics && showAnalytics && (
              <Tabs.Content value={TabStateType.ANALYTICS} className="outline-none">
                <AnalyticsTab />
              </Tabs.Content>
            )}

            {canAccessTags && (
              <Tabs.Content value={TabStateType.TAGS} className="outline-none">
                <TagsManagement />
              </Tabs.Content>
            )}
          </Box>
        </Tabs.Root>
      )}
    </>
  );
}

export default UserManagementTabs;
