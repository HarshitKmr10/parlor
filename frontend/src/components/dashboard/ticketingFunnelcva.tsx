'use client';

import { Box, Spinner, Text, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import Shimmer from 'components/common/Shimmer';


interface FunnelData {
  totalQueries: number;
  totalAnsweredQueries: number;
  totalTicketsCreated: number;
  totalTicketsResolved: number;
  conversionRate: number;
}

export interface DashboardData {
  org: {
    users: number;
    kb_collections: number;
    kb_documents: number;
  };
  agent_assist: {
    agent_count: number;
    queries: number;
    tickets_created: number;
    tickets_resolved: number;
    time_spent_by_agent: Record<string, number>;
    chat_sessions: number;
    answered_queries: number;
    total_queries: number;
  };
}

interface TicketingFunnelProps {
  timeFilter: string;
  ticketingFunnel: {
    total_queries: number;
    total_tickets_created: number;
    total_tickets_resolved: number;
    tickets_created_per_day: Record<string, number>;
    tickets_resolved_per_day: Record<string, number>;
  } | null;
  loading?: boolean;
}

export function TicketingFunnel({ timeFilter, ticketingFunnel, loading }: TicketingFunnelProps) {
  const { t } = useTranslation();
  // Use the data directly from ticketingFunnel
  const data = ticketingFunnel ? {
    totalQueries: ticketingFunnel.total_queries,
    totalTicketsCreated: ticketingFunnel.total_tickets_created,
    totalTicketsResolved: ticketingFunnel.total_tickets_resolved,
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
        <Box className="h-[295px] relative bottom-[5px]">
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
                {/* First section */}
                <path 
                  opacity="0.1" 
                  d="M251.804 130.535H0.616211V0.351562C0.616211 0.351562 39.3987 1.4663 63.6874 6.28758C88.7241 11.2573 101.989 17.4718 126.21 25.6936C149.974 33.7601 162.233 41.8217 186.539 47.9215C211.521 54.1908 251.804 56.8126 251.804 56.8126V130.535Z"
                  transform="translate(0, 18) scale(1.5, 1.5)"
                  fill="url(#paint0_linear_9043_98358)"
                />

                {/* Second section */}
                <path 
                  opacity="0.1" 
                  d="M251.231 75.5348H0.0429688V0.257812C0.0429688 0.257812 38.9109 3.17274 63.1142 9.06682C88.2355 15.1845 101.146 22.8807 125.637 31.3493C149.13 39.4729 161.692 46.5909 185.966 51.5999C211.043 56.7748 251.231 56.7411 251.231 56.7411V75.5348Z"
                  transform="translate(300, 125) scale(1.5, 1.5)"
                  fill="url(#paint0_linear_9043_98356)"
                />

                {/* Third section */}
                <path 
                  opacity="0.1" 
                  d="M251.234 20.6304H0.0458984V0.0234375C0.0458984 0.0234375 38.9138 0.821394 63.1171 2.43489C88.2384 4.10959 101.149 6.21641 125.64 8.5347C149.133 10.7585 161.695 12.707 185.969 14.0782C211.046 15.4949 251.234 15.4856 251.234 15.4856V20.6304Z"
                  transform="translate(600, 180) scale(1.5, 1.5)"
                  fill="url(#paint0_linear_9043_98355)"
                />

                <defs>
                  <linearGradient id="paint0_linear_9043_98358" x1="126.21" y1="0.351562" x2="126.21" y2="130.535" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8979FF" stopOpacity="0.5"/>
                    <stop offset="1" stopColor="#8979FF" stopOpacity="0.15"/>
                  </linearGradient>
                  <linearGradient id="paint0_linear_9043_98356" x1="125.637" y1="0.257812" x2="125.637" y2="75.5348" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8979FF" stopOpacity="0.3"/>
                    <stop offset="1" stopColor="#8979FF" stopOpacity="0.05"/>
                  </linearGradient>
                  <linearGradient id="paint0_linear_9043_98355" x1="125.64" y1="0.0234375" x2="125.64" y2="20.6304" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8979FF" stopOpacity="0.3"/>
                    <stop offset="1" stopColor="#8979FF" stopOpacity="0.05"/>
                  </linearGradient>
                </defs>
              </svg>
              
            </div>

            {/* Original SVG on top */}
            <svg width="100%" height="300" viewBox="0 0 1250 200" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* First section */}
              <path 
                d="M251.804 128.805H0.616211V0.984375C0.616211 0.984375 39.3987 2.07888 63.6874 6.81266C88.7241 11.6922 101.989 17.7939 126.21 25.8665C149.974 33.7865 162.233 41.7018 186.539 47.6909C211.521 53.8465 251.804 56.4207 251.804 56.4207V128.805Z"
                transform="translate(0, 18) scale(1.5, 1.5)"
                fill="url(#paint0_linear_9043_98363)"
              />

              {/* Second section */}
              <path 
                d="M251.231 73.8048H0.0429688V0.890625C0.0429688 0.890625 38.9109 3.71406 63.1142 9.42314C88.2355 15.3488 101.146 22.8034 125.637 31.0063C149.13 38.8748 161.692 45.7694 185.966 50.6212C211.043 55.6336 251.231 55.601 251.231 55.601V73.8048Z"
                transform="translate(400, 100) scale(1.5, 1.5)"
                fill="url(#paint0_linear_9043_98360)"
              />

              {/* Third section */}
              <path 
                d="M251.234 20.8039H0.0458984V0.84375C0.0458984 0.84375 38.9138 1.61666 63.1171 3.17951C88.2384 4.80165 101.149 6.84234 125.64 9.08786C149.133 11.2419 161.695 13.1292 185.969 14.4574C211.046 15.8296 251.234 15.8206 251.234 15.8206V20.8039Z"
                transform="translate(800, 180) scale(1.5, 1.5)"
                fill="url(#paint0_linear_9043_98364)"
              />

              <defs>
                <linearGradient id="paint0_linear_9043_98363" x1="126.21" y1="0.984375" x2="126.21" y2="128.805" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8979FF" stopOpacity="0.5"/>
                  <stop offset="1" stopColor="#8979FF" stopOpacity="0.15"/>
                </linearGradient>
                <linearGradient id="paint0_linear_9043_98360" x1="125.637" y1="0.890625" x2="125.637" y2="73.8048" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8979FF" stopOpacity="0.3"/>
                  <stop offset="1" stopColor="#8979FF" stopOpacity="0.05"/>
                </linearGradient>
                <linearGradient id="paint0_linear_9043_98364" x1="125.64" y1="0.84375" x2="125.64" y2="29.6395" gradientUnits="userSpaceOnUse">
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
        
            
            <Box className="absolute text-left min-w-[120px]" style={{ left: '33%' }}>
              <MetricBox
                value={loading ? <Shimmer width='3rem' height='2.5rem'/> : data?.totalTicketsCreated}
                label={data?.totalTicketsCreated === 1 ? t('dashboard.ticketCreated') : t('dashboard.ticketsCreated')}
                color="#A5B4FC"
              />
            </Box>
            
            <Box className="absolute text-left" style={{ left: '65%' }}>
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