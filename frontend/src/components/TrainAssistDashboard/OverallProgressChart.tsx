'use client';
import React from 'react';
import { Box, Text, Flex } from '@radix-ui/themes';
import Shimmer from 'components/common/Shimmer';

interface OverallProgressData {
  topic_started: number;
  quizes_attempted: number;
  simulation_done: number;
}

interface OverallProgressChartProps {
  data: OverallProgressData | null;
  loading: boolean;
}

const OverallProgressChart: React.FC<OverallProgressChartProps> = ({
  data,
  loading,
}) => {
  if (loading) {
    return (
      <Box className="p-8 rounded-lg border bg-white h-[400px] flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </Box>
    );
  }

  return (
    <Box className="p-8 rounded-lg border bg-white h-[400px]">
      <Box className="flex justify-between items-start mb-4">
        <Text size="5" weight="medium">Learning Progress Funnel</Text>
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
                  fill="url(#paint0_linear_background_topics)"
                />
                <defs>
                  <linearGradient id="paint0_linear_background_topics" x1="113.802" y1="0.464844" x2="113.802" y2="179.805" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4F46E5" stopOpacity="0.2"/>
                    <stop offset="1" stopColor="#4F46E5" stopOpacity="0.05"/>
                  </linearGradient>
                </defs>
                <path opacity="0.1" 
                    d="M184.824 130.535H0.251709V0.351562C0.251709 0.351562 28.749 1.4663 46.5962 6.28758C64.9931 11.2573 74.7403 17.4718 92.5378 25.6936C109.999 33.7601 119.007 41.8217 136.867 47.9215C155.224 54.1908 184.824 56.8126 184.824 56.8126V130.535Z" 
                    transform="translate(280, 55)"
                    fill="url(#paint0_linear_background_quizzes)"/>
                <defs>
                   <linearGradient id="paint0_linear_background_quizzes" x1="92.5378" y1="0.351562" x2="92.5378" y2="130.535" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#2563EB" stopOpacity="0.8"/>
                    <stop offset="1" stopColor="#2563EB" stopOpacity="0.8"/>
                   </linearGradient>
                </defs>
                <path opacity="0.1" 
                    transform="translate(520, 110) scale(1.17, 1)"
                    d="M184.92 75.5348H0.347656V0.257812C0.347656 0.257812 28.9077 3.17274 46.6921 9.06682C65.1512 15.1845 74.6376 22.8807 92.6337 31.3493C109.896 39.4729 119.127 46.5909 136.963 51.5999C155.39 56.7748 184.92 56.7411 184.92 56.7411V75.5348Z" 
                    fill="url(#paint0_linear_background_sims)"
                />
                <defs>
                   <linearGradient id="paint0_linear_background_sims"  x1="92.5378" y1="0.351562" x2="92.5378" y2="75.5348" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0891B2" stopOpacity="0.8"/>
                    <stop offset="1" stopColor="#0891B2" stopOpacity="0.8"/>
                   </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Main SVG funnel */}
            <svg width="100%" height="300" viewBox="0 0 950 200" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Topics Started - Largest section */}
              <path 
                d="M227.038 179.805H0.566284V0.464844C0.566284 0.464844 35.3208 3.50932 57.4314 8.64227C79.5421 13.7752 91.9758 18.9098 113.802 26.7523C135.243 34.4565 146.084 43.233 168.195 48.366C190.306 53.4989 227.038 53.0398 227.038 53.0398V179.805Z"
                transform="translate(-10, 18)"
                fill="url(#paint0_linear_topics)"
              />

              {/* Quizzes Attempted - Medium section */}
              <path 
                d="M184.824 130.535H0.251709V0.351562C0.251709 0.351562 28.749 1.4663 46.5962 6.28758C64.9931 11.2573 74.7403 17.4718 92.5378 25.6936C109.999 33.7601 119.007 41.8217 136.867 47.9215C155.224 54.1908 184.824 56.8126 184.824 56.8126V130.535Z"
                transform="translate(280, 68)"
                fill="url(#paint0_linear_quizzes)"
              />

              {/* Simulations Done - Smallest section */}
              <path 
                d="M216.331 73.8048H0.617554V0.890625C0.617554 0.890625 33.9962 3.71406 54.7812 9.42314C76.3547 15.3488 87.4416 22.8034 108.474 31.0063C128.649 38.8748 139.437 45.7694 160.283 50.6212C181.819 55.6336 216.331 55.601 216.331 55.601V73.8048Z"
                transform="translate(520, 125)"
                fill="url(#paint0_linear_simulations)"
              />

              <defs>
                <linearGradient id="paint0_linear_topics" x1="113.802" y1="0.464844" x2="113.802" y2="179.805" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#4F46E5"/>
                  <stop offset="1" stopColor="#4F46E5" stopOpacity="0.25"/>
                </linearGradient>
                <linearGradient id="paint0_linear_quizzes" x1="107.968" y1="0.985352" x2="107.968" y2="128.806" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2563EB" stopOpacity="0.8"/>
                  <stop offset="1" stopColor="#2563EB" stopOpacity="0.15"/>
                </linearGradient>
                <linearGradient id="paint0_linear_simulations" x1="108.474" y1="0.890625" x2="108.474" y2="73.8048" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0891B2" stopOpacity="0.9"/>
                  <stop offset="1" stopColor="#0891B2" stopOpacity="0.3"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </Box>

        {/* Metrics positioned at bottom */}
        <Box className="absolute w-full" style={{ bottom: 'min(2rem, 10%)' }}>
          <Flex className="relative">
            <Box className="absolute text-left" style={{ left: '5%' }}>
              <MetricBox
                value={loading ? <Shimmer width='3rem' height='2.5rem'/> : data?.topic_started || 0}
                label={data?.topic_started === 1 ? "Topic Started" : "Topics Started"}
                color="#4F46E5"
              />
            </Box>
            
            <Box className="absolute text-left min-w-[120px]" style={{ left: '35%' }}>
              <MetricBox
                value={loading ? <Shimmer width='3rem' height='2.5rem'/> : data?.quizes_attempted || 0}
                label={data?.quizes_attempted === 1 ? "Quiz Attempted" : "Quizzes Attempted"}
                color="#2563EB"
              />
            </Box>
            
            <Box className="absolute text-left min-w-[120px]" style={{ left: '65%' }}>
              <MetricBox
                value={loading ? <Shimmer width='3rem' height='2.5rem'/> : data?.simulation_done || 0}
                label={data?.simulation_done === 1 ? "Simulation Done" : "Simulations Done"}
                color="#0891B2"
              />
            </Box>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
};

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

export default OverallProgressChart; 