import { Flex, Text } from '@radix-ui/themes';
import KBAssistConfig from './KBAssistConfig';
import { SVGProps, useMemo, useState } from 'react';
import clsx from 'clsx';
import { GraduationCapIcon, BookMinus } from 'lucide-react';
import AgentAssistIcon from 'components/icons/AgentAssistIcon';
import AgentAssistConfig from './AgentAssistConfig';
import TrainAssistConfig from '../../../../../components/admin/TrainAssist/TrainAssistConfig';
import { useGlobalContext } from 'contexts/store';
import { getEnabledModules } from 'utils/getEnabledModules';
import { ModuleKey } from 'constants/global';
import ChatVirtualAgentConfig from './ChatVirtualAgentConfig';
import { MdChat } from 'react-icons/md';
import useUserRoles from 'hooks/useUserRoles';
import { useTranslation } from 'react-i18next';

const clientName = process.env.NEXT_PUBLIC_CLIENT;
const isPROFILE_GD = clientName === 'PROFILE_GD';

interface ConfigTab {
  id: string;
  name: string;
  icon: React.FC<SVGProps<SVGSVGElement>>;
  module: ModuleKey;
}

const getConfigTabList = (t: any): ConfigTab[] => [
  {
    id: 'knowledgeAssistConfig',
    name: isPROFILE_GD ? t('admin_panel.knowledgeAssistAI') : t('admin_panel.knowledgeAssist'),
    icon: BookMinus,
    module: 'knowledge_assist',
  },
  {
    id: 'agentAssistConfig',
    name: isPROFILE_GD ? t('admin_panel.agentAssistAI') : t('admin_panel.agentAssist'),
    icon: AgentAssistIcon,
    module: 'agent_assist',
  },
  {
    id: 'trainAssistConfig',
    name: isPROFILE_GD ? t('admin_panel.trainingAssistAI') : t('admin_panel.trainAssist'),
    icon: GraduationCapIcon,
    module: 'train_assist',
  },
  {
    id: 'chatVirtualAgentConfig',
    name: t('admin_panel.chatVirtualAgent'),
    icon: MdChat,
    module: 'chat_virtual_agent',
  },
];

function ModuleSettings() {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState('');
  const { organization } = useGlobalContext();
  const roles = useUserRoles();

  // Define role-based access control for each module
  const canAccessModule = (module: ModuleKey): boolean => {
    switch (module) {
      case 'knowledge_assist':
        return roles.knowledge_assist_admin;
      case 'agent_assist':
        return roles.agent_assist_admin;
      case 'train_assist':
        return roles.train_assist_admin;
      case 'chat_virtual_agent':
        return roles.chat_virtual_agent_admin;
      default:
        return false;
    }
  };

  const tabs = useMemo(() => {
    try {
      const config = JSON.parse(organization.config);
      const enabledModules = getEnabledModules(config.Modules);
      const CONFIG_TAB_LIST = getConfigTabList(t);
      
      // Filter tabs based on both enabled modules AND user roles
      const filteredTabs = CONFIG_TAB_LIST.filter((tab) => 
        enabledModules.includes(tab.module) && canAccessModule(tab.module)
      );
      
      // if the selected tab is not in the filtered tabs, set the first tab as the selected tab
      if (!filteredTabs.some((tab) => tab.id === selectedTab)) {
        setSelectedTab(filteredTabs?.[0]?.id || '');
      }
      return filteredTabs;
    } catch (error) {
      console.error(`Error parsing organization config: ${error}`);
      return [];
    }
  }, [organization, selectedTab, roles.knowledge_assist_admin, roles.agent_assist_admin, roles.train_assist_admin, roles.platform_admin, t]);

  // Check if user has any module access
  const hasAnyAccess = tabs.length > 0;

  if (!hasAnyAccess) {
    return (
      <Flex direction="column" align="center" justify="center" className="p-8 min-h-[400px]">
        <Text size="5" weight="medium" className="text-gray-600 mb-4">
          {t('admin_panel.noModuleAccess')}
        </Text>
        <Text size="3" className="text-gray-500 text-center max-w-md">
          {t('admin_panel.noPermissionToAccessModuleSettings')}
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="row" align="stretch">
      <ConfigTabs
        selectedTab={selectedTab}
        onTabSelected={setSelectedTab}
        tabList={tabs}
        className='top-[41px] sticky h-[calc(100vh-152px)]'
      />
      <Flex className="border-l flex-1">
        {selectedTab === 'knowledgeAssistConfig' && <KBAssistConfig />}
        {selectedTab === 'agentAssistConfig' && <AgentAssistConfig />}
        {selectedTab === 'trainAssistConfig' && <TrainAssistConfig />}
        {selectedTab === 'chatVirtualAgentConfig' && <ChatVirtualAgentConfig />}
      </Flex>
    </Flex>
  );
}

export default ModuleSettings;

interface ConfigTabsProps {
    selectedTab: string;
    onTabSelected: (selectedTab: string) => void;
    tabList: ConfigTab[];
    className?: string;
}
  
const ConfigTabs = (props: ConfigTabsProps) => {
    const { selectedTab, onTabSelected, tabList, className } = props;
  
    return (
      <Flex
        direction="column"
        gap="2"
        className={clsx('w-[240px] px-2 py-4', className)}
      >
        {tabList?.map(({ id, name, icon: Icon }) => (
          <Flex
            key={id}
            align="center"
            gap="2"
            onClick={() => onTabSelected(id)}
            className={clsx(
              'cursor-pointer rounded-full px-4 py-1.5 transition-background',
              id === selectedTab
                ? 'bg-iris-10 text-white'
                : 'text-iris-10 hover:bg-iris-9 hover:text-white',
            )}
          >
            <Icon height={18} width={18} />
            <Text size="2">{name}</Text>
          </Flex>
        ))}
      </Flex>
    );
};
