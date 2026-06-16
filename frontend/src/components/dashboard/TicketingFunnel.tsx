'use client';

import { AgentAssistDashboardData } from '@/hooks/useAgentDashboard';
import { Box, Text, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import Shimmer from 'components/common/Shimmer';


interface FunnelData {
  totalQueries: number;
  totalAnsweredQueries: number;
  totalTicketsCreated: number;
  totalTicketsResolved: number;
  conversionRate: number;
}



interface TicketingFunnelProps {
  timeFilter: string;
  dashboardData: AgentAssistDashboardData | null;
  loading?: boolean;
}

export function TicketingFunnel({ timeFilter, dashboardData, loading }: TicketingFunnelProps) {
  const { t } = useTranslation();

  const data = dashboardData ? {
    totalQueries: dashboardData.agent_assist.queries,
    totalAnsweredQueries: dashboardData.agent_assist.answered_queries,
    totalTicketsCreated: dashboardData.agent_assist.tickets_created,
    totalTicketsResolved: dashboardData.agent_assist.tickets_resolved,
  } : null;

  return (
    <Box className="p-8 rounded-lg border bg-white">
      <Box className="flex justify-between items-start mb-4">
        <Text size="5" weight="medium">{t('dashboard.ticketingFunnel')}</Text>
        {/* <Box className="flex items-baseline p-4 rounded-lg bg-gradient-to-r from-white to-[#F5F7FF] shadow-lg">
          <Text size="4" className="text-[#4F46E5] text-[36px] leading-none mr-2" weight="medium">
            {data ? ((data.totalAnsweredQueries / data.totalQueries) * 100).toFixed(1) : ''}%
          </Text>
          <Box className="flex flex-col">
            <Text size="3" weight="medium">Conversion rate</Text>
            <Text size="2" color="gray">
              for the past 7 days
            </Text>
          </Box>
        </Box> */}
      </Box>

      <Box className="relative gap-4">
        <Box className="h-[300px] relative bottom-[15px]">
          <div className="absolute inset-0 flex items-start">
            {/* Background animated SVGs */}
            <div className="absolute inset-0 flex items-start">
              <svg 
                width="100%" 
                height="300" 
                viewBox="0 0 950 200" 
                preserveAspectRatio="xMidYMid meet" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="animate-pulse opacity-20"
                style={{ animationDuration: '4s' }}
              >
                <path 
                  d="M227.038 179.805H0.566284V0.464844C0.566284 0.464844 35.3208 3.50932 57.4314 8.64227C79.5421 13.7752 91.9758 18.9098 113.802 26.7523C135.243 34.4565 146.084 43.233 168.195 48.366C190.306 53.4989 227.038 53.0398 227.038 53.0398V179.805Z"
                  transform="translate(-10, 1)"
                  fill="url(#paint0_linear_background_2)"
                />
                <defs>
                  <linearGradient id="paint0_linear_background_2" x1="113.802" y1="0.464844" x2="113.802" y2="179.805" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8979FF" stopOpacity="0.2"/>
                    <stop offset="1" stopColor="#8979FF" stopOpacity="0.05"/>
                  </linearGradient>
                </defs>
                <path opacity="0.1" 
                    d="M184.824 130.535H0.251709V0.351562C0.251709 0.351562 28.749 1.4663 46.5962 6.28758C64.9931 11.2573 74.7403 17.4718 92.5378 25.6936C109.999 33.7601 119.007 41.8217 136.867 47.9215C155.224 54.1908 184.824 56.8126 184.824 56.8126V130.535Z" 
                    transform="translate(230, 55)"
                    fill="url(#paint0_linear_6603_98920)"/>
                <defs>
                   <linearGradient id="paint0_linear_6603_98920" x1="92.5378" y1="0.351562" x2="92.5378" y2="130.535" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8979FF" stopOpacity="0.8"/>
                    <stop offset="1" stopColor="#8979FF" stopOpacity="0.8"/>
                   </linearGradient>
                </defs>
                <path opacity="0.1" 
                    transform="translate(430, 110) scale(1.17, 1)"
                    d="M184.92 75.5348H0.347656V0.257812C0.347656 0.257812 28.9077 3.17274 46.6921 9.06682C65.1512 15.1845 74.6376 22.8807 92.6337 31.3493C109.896 39.4729 119.127 46.5909 136.963 51.5999C155.39 56.7748 184.92 56.7411 184.92 56.7411V75.5348Z" 
                    fill="url(#paint0_linear_6603_98918)"
                />
                <defs>
                   <linearGradient id="paint0_linear_6603_98918"  x1="92.5378" y1="0.351562" x2="92.5378" y2="75.5348" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8979FF" stopOpacity="0.8"/>
                    <stop offset="1" stopColor="#8979FF" stopOpacity="0.8"/>
                   </linearGradient>
                </defs>
                <path opacity="0.1" 
                transform="translate(660, 170) scale(1.17, 1)" d="M185.234 20.6304H0.662109V0.0234375C0.662109 0.0234375 29.2221 0.821394 47.0066 2.43489C65.4657 4.10959 74.952 6.21641 92.9482 8.5347C110.211 10.7585 119.442 12.707 137.278 14.0782C155.705 15.4949 185.234 15.4856 185.234 15.4856V20.6304Z" fill="url(#paint0_linear_6603_98917)"/>
                <defs>
                  <linearGradient id="paint0_linear_6603_98917" x1="92.9482" y1="0.0234375" x2="92.9482" y2="20.6304" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8979FF" stopOpacity="0.3"/>
                    <stop offset="1" stopColor="#8979FF" stopOpacity="0.05"/>
                  </linearGradient>
                </defs>
              </svg>
              
            </div>

            {/* Original SVG on top */}
            <svg width="100%" height="300" viewBox="0 0 950 200" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Keep your existing path definitions, just adjust transforms */}
              <path 
                d="M227.038 179.805H0.566284V0.464844C0.566284 0.464844 35.3208 3.50932 57.4314 8.64227C79.5421 13.7752 91.9758 18.9098 113.802 26.7523C135.243 34.4565 146.084 43.233 168.195 48.366C190.306 53.4989 227.038 53.0398 227.038 53.0398V179.805Z"
                transform="translate(-10, 18)"
                fill="url(#paint0_linear_6578_92415)"
              />

              {/* Second section - Answered Queries */}
              <path 
                d="M184.824 130.535H0.251709V0.351562C0.251709 0.351562 28.749 1.4663 46.5962 6.28758C64.9931 11.2573 74.7403 17.4718 92.5378 25.6936C109.999 33.7601 119.007 41.8217 136.867 47.9215C155.224 54.1908 184.824 56.8126 184.824 56.8126V130.535Z"
                transform="translate(230, 68)"
                fill="url(#paint0_linear_6578_92416)"
              />

              {/* Third section - Tickets Created (120) */}
              <path 
                d="M216.331 73.8048H0.617554V0.890625C0.617554 0.890625 33.9962 3.71406 54.7812 9.42314C76.3547 15.3488 87.4416 22.8034 108.474 31.0063C128.649 38.8748 139.437 45.7694 160.283 50.6212C181.819 55.6336 216.331 55.601 216.331 55.601V73.8048Z"
                transform="translate(430, 125)"
                fill="url(#paint0_linear_6578_92413)"
              />

              {/* Fourth section - Tickets Resolved (50) */}
              <path 
                d="M215.755 20.8049H0.0415649V0.844727C0.0415649 0.844727 33.4202 1.61764 54.2053 3.18049C75.7787 4.80262 86.8656 6.84331 107.898 9.08884C128.073 11.2428 138.861 13.1302 159.707 14.4584C181.243 15.8305 215.755 15.8216 215.755 15.8216V20.8049Z"
                transform="translate(660, 180)"
                fill="url(#paint0_linear_6578_92417)"
              />

              <defs>
                <linearGradient id="paint0_linear_6578_92415" x1="113.802" y1="0.464844" x2="113.802" y2="179.805" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8979FF"/>
                  <stop offset="1" stopColor="#8979FF" stopOpacity="0.25"/>
                </linearGradient>
                <linearGradient id="paint0_linear_6578_92416" x1="107.968" y1="0.985352" x2="107.968" y2="128.806" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8979FF" stopOpacity="0.5"/>
                  <stop offset="1" stopColor="#8979FF" stopOpacity="0.15"/>
                </linearGradient>
                <linearGradient id="paint0_linear_6578_92413" x1="108.474" y1="0.890625" x2="108.474" y2="73.8048" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8979FF" stopOpacity="0.3"/>
                  <stop offset="1" stopColor="#8979FF" stopOpacity="0.05"/>
                </linearGradient>
                <linearGradient id="paint0_linear_6578_92417" x1="107.898" y1="0.844727" x2="107.898" y2="29.6404" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#CCF5FF" stopOpacity="0.772549"/>
                  <stop offset="1" stopColor="#CCF5FF" stopOpacity="0.05"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </Box>

        {/* Metrics - adjusted left alignment for all sections */}
        <Box className="absolute w-full" style={{ bottom: 'min(2rem, 10%)' }}>
          <Flex className="relative">
            <Box className="absolute text-left" style={{ left: '0%' }}>
              <MetricBox
                value={loading ? <Shimmer width='3rem'  height='2.5rem'/> : data?.totalQueries}
                label={data?.totalQueries === 1 ? t('dashboard.totalQuery') : t('dashboard.totalQueriesPlural')}
                color="#4F46E5"
              />
            </Box>
            
            <Box className="absolute text-left min-w-[120px]" style={{ left: '24%' }}>
              <MetricBox
                value={loading ? <Shimmer width='3rem'  height='2.5rem'/> : data?.totalAnsweredQueries}
                label={data?.totalAnsweredQueries === 1 ? t('dashboard.answeredQuery') : t('dashboard.answeredQueries')}
                color="#818CF8"
              />
            </Box>
            
            <Box className="absolute text-left min-w-[120px]" style={{ left: '47%' }}>
              <MetricBox
                value={loading ? <Shimmer width='3rem'  height='2.5rem'/> : data?.totalTicketsCreated}
                label={data?.totalTicketsCreated === 1 ? t('dashboard.ticketCreated') : t('dashboard.ticketsCreated')}
                color="#A5B4FC"
              />
            </Box>
            
            <Box className="absolute text-left" style={{ left: '70%' }}>
              <MetricBox
                value={loading ? <Shimmer width='3rem'  height='2.5rem'/> : data?.totalTicketsResolved}
                label={data?.totalTicketsResolved === 1 ? t('dashboard.ticketResolved') : t('dashboard.ticketsResolved')}
                color="#C7D2FE"
              />
            </Box>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}

interface MetricBoxProps {
  value: number | React.ReactNode;
  label: string;
  color: string;
}

function MetricBox({ value, label, color }: MetricBoxProps) {
  // Split the label into two parts at the space
  const [firstWord, ...restWords] = label.split(' ');
  
  return (
    <Flex gap="3">
      <Text size="8" weight="medium" style={{ color }}>
        {value}
      </Text>
      <Box className="flex flex-col justify-center -ml-2">
        <Text size="2" color="gray" className="leading-tight">
          {firstWord}
        </Text>
        <Text size="2" color="gray" className="leading-tight">
          {restWords.join(' ')}
        </Text>
      </Box>
    </Flex>
  );
}