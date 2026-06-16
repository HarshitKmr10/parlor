import React from 'react';
import { GoCopilot } from 'react-icons/go';
import { IconType } from 'react-icons';
import { RiChatVoiceLine } from 'react-icons/ri';
import AgentAssistIcon from 'components/icons/AgentAssistIcon';
import CallLogIcon from 'components/icons/CallLogIcon';
import { GrUserExpert } from 'react-icons/gr';
import { IRoute } from 'types/navigation';
import { MdChat, MdOutlinePriorityHigh } from 'react-icons/md';
import { LuBookMinus } from 'react-icons/lu';
import { FaGraduationCap } from 'react-icons/fa';
import { IoCodeWorkingSharp, IoAnalyticsOutline } from 'react-icons/io5';
import { HomeOutlineIcon } from 'components/icons/HomeOutlineIcon';
import { C8HomeIcon } from 'components/icons/C8HomeIcon';
import VendorCopilotIcon from 'components/icons/VendorCopilotIcon';
import LeadCopilotIcon from 'components/icons/LeadCopilotIcon';
import APAutomationIcon from 'components/icons/APAutomationIcon';
import PayrollCopilotIcon from 'components/icons/PayrollCopilotIcon';
import ServiceBulletinIcon from 'components/icons/ServiceBulletinIcon';

const clientName = process.env.NEXT_PUBLIC_CLIENT;
/**
 * Utility function to create icon components with consistent styling.
 * @param {IconType} IconComponent - The icon component to render with styles.
 * @returns {JSX.Element} A styled icon component.
 * @throws {Error} If an invalid icon component is provided.
 */
const createIcon = (IconComponent: IconType): JSX.Element => {
  if (!IconComponent) {
    throw new Error('Invalid icon component provided');
  }
  return <IconComponent className="text-inherit h-5 w-5 font-extrabold" />;
};

const createIconWithStyles = (IconComponent: IconType): JSX.Element => {
  if (!IconComponent) {
    throw new Error('Invalid icon component provided');
  }
  return <IconComponent className="text-inherit h-8 w-8 font-extrabold" />;
};

/**
 * Array of route definitions for navigation, typed with the IRoute interface.
 * Each route includes a name, layout (if any), path, icon, and indication of sub-routes.
 */
const routeDefinitions: ReadonlyArray<IRoute> = [
  // DashBoard Icon -- MdOutlineDashboard
  {
    name: 'Home',
    layout: '',
    path: '/home',
    icon: clientName === 'PROFILE_C8'
      ? <C8HomeIcon className="text-inherit h-5 w-5" />
      : createIcon(HomeOutlineIcon),
    collapse: false,
  },
  {
    name: clientName === 'PROFILE_GD' ? 'Knowledge Assist AI' : 'Knowledge Assist',
    layout: '',
    path: '/knowledge/dashboard',
    icon: createIcon(LuBookMinus),
    collapse: false,
  },
  // {
  //   name: 'Knowledge AI',
  //   layout: '',
  //   path: '/knowledge/logs',
  //   icon: createIcon(MdOutlineVideocam),
  //   collapse: false,
  // },
  {
    name: clientName === 'PROFILE_GD' ? 'Training Assist AI' : 'Train Assist',
    layout: '',
    path: '/train-assist-2',
    icon: createIcon(FaGraduationCap),
    collapse: false,
  },
  {
    name: clientName === 'PROFILE_GD' ? 'Training Assist AI' : 'Train Assist',
    layout: '',
    path: '/train-assist',
    icon: createIcon(FaGraduationCap),
    collapse: false,
  },
  {
    name: clientName === 'PROFILE_GD' ? 'Agent Assist AI' : 'Agent Assist',
    layout: '',
    path: '/agent-assist',
    icon: createIcon(AgentAssistIcon),
    collapse: false,
  },
  {
    name: 'Voice Co-Resolve',
    layout: '',
    path: '/calls',
    icon: createIcon(CallLogIcon),
    collapse: false,
  },
  {
    name: 'NOC Co-Resolve',
    layout: '',
    path: '/noc-copilot',
    icon: createIcon(GoCopilot),
    collapse: false,
  },
  {
    name: 'Voice Virtual Agent',
    layout: '',
    path: '/voice-virtual-agent',
    icon: createIcon(RiChatVoiceLine),
    collapse: false,
  },
  {
    name: 'Expert Co-Resolve',
    layout: '',
    path: '/expert-copilot',
    icon: createIcon(GrUserExpert),
    collapse: false,
  },
  {
    name: 'Cross Functional CoResolve',
    layout: '',
    path: '/cross-functional-coresolve',
    icon: createIcon(IoCodeWorkingSharp),
    collapse: false,
  },
  {
    name: 'P1 Co-Resolve',
    layout: '',
    path: '/p1/logs',
    icon: createIcon(MdOutlinePriorityHigh),
    collapse: false,
  },
  {
    name: 'NOC Virtual Analyst',
    layout: '',
    path: '/observability',
    icon: createIcon(IoAnalyticsOutline),
    collapse: false,
  },
  {
    name: 'Chat Virtual Agent',
    layout: '',
    path: '/chat-virtual-agent',
    icon: createIcon(MdChat),
    collapse: false,
  },
  {
    name: 'AP Automation',
    layout: '',
    path: '/ap-automation',
    icon: <APAutomationIcon className="text-inherit h-5 w-5 font-extrabold" />,
    collapse: false,
  },
  {
    name: 'Payroll Co-Pilot',
    layout: '',
    path: '/payroll-copilot',
    icon: <PayrollCopilotIcon className="text-inherit h-5 w-5 font-extrabold" />,
    collapse: false,
  },
  {
    name: 'Service Bulletin',
    layout: '',
    path: '/service-bulletin',
    icon: <ServiceBulletinIcon className="text-inherit h-5 w-5 font-extrabold" />,
    collapse: false,
  },
  {
    name: 'Vendor Co-Pilot',
    layout: '',
    path: '/vendor-copilot',
    icon: <VendorCopilotIcon className="text-inherit h-5 w-5 font-extrabold" />,
    collapse: false,
  },
  {
    name: 'Lead Co-Pilot',
    layout: '',
    path: '/lead-copilot',
    icon: <LeadCopilotIcon className="text-inherit h-5 w-5 font-extrabold" />,
    collapse: false,
  },
] as const;

// Validate route definitions
routeDefinitions.forEach((route) => {
  if (!route.name || !route.path || !route.icon) {
    console.warn(`Invalid route configuration: ${JSON.stringify(route)}`);
  }
});

export default routeDefinitions;
