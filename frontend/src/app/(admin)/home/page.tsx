'use client';

import { Badge, Flex, Grid, Heading, Text } from '@radix-ui/themes';
import AgentAssistIcon from 'components/icons/AgentAssistIcon';
import { BookIcon } from 'components/icons/BookIcon';
import { BorderAllOutlineIcon } from 'components/icons/BorderAllOutlineIcon';
import { ChatSparkleOutline } from 'components/icons/ChatSparkleOutline';
import { DataTrendingIcon } from 'components/icons/DataTrendingIcon';
import { ErrorOutlineIcon } from 'components/icons/ErrorOutlineIcon';
import { GraduateCapIcon } from 'components/icons/GraduateCapIcon';
import { IconBox } from 'components/icons/IconBox';
import { OutlineMessageIcon } from 'components/icons/OutlineMessageIcon';
import { TransitionIcon } from 'components/icons/TransitionIcon';
import withAuth from 'components/withAuth';
import { MODULE_ROUTES } from 'constants/global';
import { useGlobalContext } from 'contexts/store';
import { PhoneCallIcon } from 'lucide-react';
import React, { SVGProps, useMemo, useState } from 'react';
import { GoCopilot } from 'react-icons/go';
import { GrUserExpert } from 'react-icons/gr';
import { RiChatVoiceLine } from 'react-icons/ri';
import { getEnabledModules } from 'utils/getEnabledModules';
import useUserRoles from 'hooks/useUserRoles';
import { IoCodeWorkingSharp } from 'react-icons/io5';
import { useTranslation } from 'react-i18next';

const clientName = process.env.NEXT_PUBLIC_CLIENT;
const isPROFILE_GD = clientName === 'PROFILE_GD';

interface ProductTag {
  name: string;
  color: string;
  icon: React.FC<SVGProps<SVGSVGElement>>;
}

interface DashBoardCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBgColor: string;
  tag: ProductTag;
  url: string;
}

function Home() {
  const { t } = useTranslation();
  const [tagFilter, setTagFilter] = useState(t('home.categories.allCategories'));
  const [searchInput, setSearchInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const { organization, user } = useGlobalContext();
  const roles = useUserRoles();

  // Get translated module titles based on client configuration
  const KNOWLEDGE_ASSIST_TITLE = isPROFILE_GD
    ? t('home.modules.knowledgeAssistAI')
    : t('home.modules.knowledgeAssist');
  const TRAIN_ASSIST_TITLE = isPROFILE_GD
    ? t('home.modules.trainAssistAI')
    : t('home.modules.trainAssist');
  const AGENT_ASSIST_TITLE = isPROFILE_GD
    ? t('home.modules.agentAssistAI')
    : t('home.modules.agentAssist');

  // Define ProductsTags with translations
  const ProductsTags: Record<string, ProductTag> = useMemo(() => ({
    ALL: {
      name: t('home.categories.allCategories'),
      color: '#333',
      icon: BorderAllOutlineIcon,
    },
    TRANSITION_ASSIST: {
      name: t('home.categories.transitionAssist'),
      color: '#6666D7',
      icon: TransitionIcon,
    },
    REACTIVE_MODULES: {
      name: t('home.categories.exCxModules'),
      color: '#00C7BE',
      icon: ChatSparkleOutline,
    },
    PROACTIVE_MODULES: {
      name: t('home.categories.techOpsModules'),
      color: '#AF52DE',
      icon: DataTrendingIcon,
    },
  }), [t]);

  // Define dashboard cards with translations
  const dashboardCards: DashBoardCard[] = useMemo(() => [
    {
      title: KNOWLEDGE_ASSIST_TITLE,
      description: t('home.modules.knowledgeAssistDescription'),
      icon: <BookIcon color="#5856D6" />,
      tag: ProductsTags.TRANSITION_ASSIST,
      iconBgColor: '#5856D640',
      url: '/knowledge/dashboard',
    },
    {
      title: TRAIN_ASSIST_TITLE,
      description: t('home.modules.trainAssistDescription'),
      icon: <GraduateCapIcon color="#5856D6" />,
      tag: ProductsTags.TRANSITION_ASSIST,
      iconBgColor: '#5856D640',
      url: '/train-assist',
    },
    {
      title: AGENT_ASSIST_TITLE,
      description: t('home.modules.agentAssistDescription'),
      icon: <AgentAssistIcon color="#5856D6" height="20px" width="20px" />,
      tag: ProductsTags.REACTIVE_MODULES,
      iconBgColor: '#5856D640',
      url: '/agent-assist',
    },
    {
      title: t('home.modules.voiceVirtualAgent'),
      description: t('home.modules.voiceVirtualAgentDescription'),
      icon: <RiChatVoiceLine color="#00c7be" />,
      tag: ProductsTags.REACTIVE_MODULES,
      iconBgColor: '#00c7be40',
      url: '/voice-virtual-agent',
    },
    {
      title: t('home.modules.voiceCoResolve'),
      description: t('home.modules.voiceCoResolveDescription'),
      icon: <PhoneCallIcon color="#00c7be" size="16px" />,
      tag: ProductsTags.REACTIVE_MODULES,
      iconBgColor: '#00c7be40',
      url: '/calls?showCall=true',
    },
    {
      title: t('home.modules.chatVirtualAgent'),
      description: t('home.modules.chatVirtualAgentDescription'),
      icon: <OutlineMessageIcon color="#00C7BE" />,
      tag: ProductsTags.REACTIVE_MODULES,
      iconBgColor: '#00c7be40',
      url: '/chat-virtual-agent',
    },
    {
      title: t('home.modules.nocCoResolve'),
      description: t('home.modules.nocCoResolveDescription'),
      icon: <RiChatVoiceLine color="#D6409F" />,
      tag: ProductsTags.PROACTIVE_MODULES,
      iconBgColor: '#D6409F40',
      url: '/noc-copilot',
    },
    {
      title: t('home.modules.nocVirtualAgent'),
      description: t('home.modules.nocVirtualAgentDescription'),
      icon: <GoCopilot color="#D6409F" />,
      tag: ProductsTags.PROACTIVE_MODULES,
      iconBgColor: '#D6409F40',
      url: '/observability',
    },
    {
      title: t('home.modules.expertCoResolve'),
      description: t('home.modules.expertCoResolveDescription'),
      icon: <GrUserExpert color="#D6409F" height="20px" width="20px" />,
      tag: ProductsTags.PROACTIVE_MODULES,
      iconBgColor: '#D6409F40',
      url: '/expert-copilot',
    },
    {
      title: t('home.modules.crossFunctionalCoResolve'),
      description: t('home.modules.crossFunctionalCoResolveDescription'),
      icon: <IoCodeWorkingSharp color="#D6409F" height="20px" width="20px" />,
      tag: ProductsTags.PROACTIVE_MODULES,
      iconBgColor: '#D6409F40',
      url: '/cross-functional-coresolve',
    },
    {
      title: t('home.modules.p1Bridge'),
      description: t('home.modules.p1BridgeDescription'),
      icon: <ErrorOutlineIcon color="#D6409F" />,
      tag: ProductsTags.PROACTIVE_MODULES,
      iconBgColor: '#D6409F40',
      url: '/p1/logs',
    },
  ], [t, KNOWLEDGE_ASSIST_TITLE, TRAIN_ASSIST_TITLE, AGENT_ASSIST_TITLE, ProductsTags]);

  const enabledDashboardCards = useMemo(() => {
    try {
      const config = JSON.parse(organization.config);
      const modules = config.Modules;

      return dashboardCards
        .filter((card) => {
          // Apply the same filtering logic as in layout.tsx
          // Extract pathname without query parameters for comparison
          const cardPath = card.url.split('?')[0];
          switch (cardPath) {
            case "/calls":
              return (modules.voice_copilot?.enabled && roles.voice_copilot_user) || false;
            case "/agent-assist":
              return (modules.agent_assist?.enabled && roles.agent_assist_user) || false;
            case "/noc-copilot":
              return modules.noc_copilot?.enabled || false;
            case "/voice-virtual-agent":
              return (modules.voice_virtual_agent?.enabled && roles.voice_virtual_agent_user) || false;
            case "/expert-copilot":
              return modules.expert_copilot?.enabled || false;
            case "/cross-functional-coresolve":
                return modules.expert_copilot?.enabled || false;
            case "/p1/logs":
              return modules.voice_p1_bridge?.enabled || false;
            case "/knowledge/dashboard":
              return (modules.knowledge_assist?.enabled && roles.knowledge_assist_user) || false;
            case "/train-assist":
              return (
                modules.train_assist?.enabled && roles.train_assist_user
              );
            case "/observability":
              return modules.anomaly_detection?.enabled || false;
            case "/chat-virtual-agent":
              if(process.env.NEXT_PUBLIC_DISABLE_CVA === "true") {
                return false;
              }
              return (modules.chat_virtual_agent?.enabled && roles.chat_virtual_agent_user) || false;
            default:
              return true;
          }
        })
        .map((card) => {
          // Reverse lookup: Find the module key whose route matches the card's URL
          const moduleKey = Object.keys(MODULE_ROUTES).find(
            (key) => MODULE_ROUTES[key] === card.url,
          );
          // Attach version, defaulting to "v1" if none is available
          const version =
            moduleKey && modules[moduleKey]?.version ? modules[moduleKey].version : 'v1';
          return { ...card, version };
        });
    } catch (error) {
      console.error(`Error parsing organization config: ${error}`);
      return [];
    }
  }, [organization, roles, dashboardCards]);

  const filteredDashboardCards = useMemo(() => {
    return enabledDashboardCards.filter((card) => {
      return tagFilter === t('home.categories.allCategories') || card.tag.name === tagFilter;
    });
  }, [tagFilter, searchFilter, enabledDashboardCards, t]);

  const gradientTheme = useMemo(() => {
    if (user?.email === 'demo_servicedesk@futurepath.dev')
      return 'bg-[#1c304b20]';
    else return 'bg-[#F4F2FE]';
  }, []);

  return (
    <Flex direction="column" className={`h-full w-full overflow-y-auto bg-[#fcfcfd]  p-6`}>
      <Flex
        direction="column"
        gap="4"
        align="center"
        justify="center"
        className={`rounded-xl ${gradientTheme}  px-6 py-10`}
      >
        <Heading size="8" highContrast>{t('home.pageTitle')}</Heading>
        <Text className="max-w-2xl" align="center" size="3" color="gray">
          {t('home.pageDescription')}
        </Text>

        <Flex gap="4">
          {Object.values(ProductsTags).map((tag) => (
            <TagBadge
              key={tag.name}
              tag={tag}
              onClick={setTagFilter}
              active={tagFilter === tag.name}
            />
          ))}
        </Flex>
      </Flex>

      <Grid columns={{ xs: "1", sm: "2", md: "3", lg: "4", xl: "5" }} className="mt-6" gap="4">
        {filteredDashboardCards.map((card) => {
          let navigationUrl = card.url;
          if (card?.title === TRAIN_ASSIST_TITLE) {
            navigationUrl =
            card?.version === "v3"
                ? "/train-assist-2"
                : "/train-assist";
          }
          return (
          <a key={card.title} href={navigationUrl} className="flex justify-stretch">
            <Flex
              direction="column"
              gap="2"
              className="transition-border w-full cursor-pointer rounded-xl border bg-white px-4 py-6 transition hover:border-[#5b5bd6] hover:shadow-sm"
            >
              <Flex direction="row" gap="2" align="center">
                <IconBox size="30px" bgColor={card.iconBgColor}>
                  {card.icon}
                </IconBox>
                <Text size="4" weight="medium" highContrast>
                  {card.title}
                </Text>
              </Flex>
              <Flex className="flex-1">
                <Text color="gray" size="2">
                  {card.description}
                </Text>
              </Flex>
              <TagBadge tag={card.tag} />
            </Flex>
          </a>
        );})}
      </Grid>
    </Flex>
  );
}

const TagBadge = ({
  tag,
  onClick,
  active,
}: {
  tag: ProductTag;
  onClick?: (name: string) => void;
  active?: boolean;
}) => {
  const handleClick = () => {
    onClick?.(tag.name);
  };

  const { user, organization } = useGlobalContext();

  const { icon: Icon } = tag;

  const parsedOrgConfig = useMemo(() => {
    if (!organization?.config) return null;
    try {
      return JSON.parse(organization.config);
    } catch (error) {
      console.error("Error parsing organization config:", error);
      return null;
    }
  }, [organization?.config]);

  const orgName = useMemo(() => {
    return parsedOrgConfig?.Name || parsedOrgConfig?.name;
  }, [parsedOrgConfig]);


  const bgColor = useMemo(() => {
    const normalizedEnv = process.env.NEXT_PUBLIC_CLIENT;
    const currentOrgName = orgName;
    const storedOrgName = typeof window !== 'undefined' ? sessionStorage.getItem('orgName') : null;

    if (normalizedEnv === 'PROFILE_DE' || currentOrgName === 'PROFILE_DE' || storedOrgName === 'PROFILE_DE')
      return '#012169';

    if (user?.email === 'demo_servicedesk@futurepath.dev')
      return '#1c304b';

    return '#6666D7';
  }, [orgName, user?.email]);

  return (
    <Badge
      radius="full"
      style={{ color: active ? '#fff' : tag.color, background: active ? `${bgColor}` : 'white' }}
      className={`transition transition-border cursor-pointer place-self-end border border-indigo-200 px-3 py-1  ${onClick ? 'hover:border-indigo-600' : ''}`}
      onClick={handleClick}
    >
      <Icon color={active ? '#fff' : tag.color} />
      <Text size="2" weight="medium">
        {tag.name}
      </Text>
    </Badge>
  );
};

export default withAuth(Home);
