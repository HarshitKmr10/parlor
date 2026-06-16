'use client';

import {
  Flex, Box, Text, ScrollArea, Button,
} from '@radix-ui/themes';
import React from 'react';
import {
  Laptop, Database, Network, Server,
} from 'lucide-react';
import AISparkleButtonIcon from 'components/icons/AISparkleButtonIcon';
import { useRouter } from 'next/navigation';
import withAuth from 'components/withAuth';
import MyCourses from './MyCourses';
import ModuleCompletionChart from './ModuleCompletionChart';
import TopPerformingAgents from './TopPerformingAgents';
import AHTPerAgent from './AHTPerAgent';
import OverallProgress from './OverallProgress';
import CreateAISuggestedModules from './CreateAISuggestedModules';

function TrainerDashboard() {
  const router = useRouter();
  const courses = [
    {
      name: 'Software',
      icon: Laptop,
      modules: 10,
      completedModules: 8,
      subCourses: [
        {
          name: 'Application Installation Failures',
          duration: '40 min',
          quizzes: 2,
        },
        {
          name: 'Software Configuration Issues',
          duration: '50 min',
          quizzes: 3,
        },
        {
          name: 'Troubleshooting Software Crashes',
          duration: '50 min',
          quizzes: 3,
        },
      ],
    },
    {
      name: 'Database',
      icon: Database,
      modules: 10,
      completedModules: 3,
      subCourses: [
        { name: 'Database Optimization', duration: '45 min', quizzes: 2 },
        { name: 'SQL Query Troubleshooting', duration: '55 min', quizzes: 3 },
      ],
    },
    {
      name: 'Network',
      icon: Network,
      completedModules: 7,
      modules: 10,
      subCourses: [
        { name: 'Network Security Basics', duration: '60 min', quizzes: 4 },
        {
          name: 'Troubleshooting Network Issues',
          duration: '50 min',
          quizzes: 3,
        },
      ],
    },
    {
      name: 'Server',
      icon: Server,
      modules: 10,
      completedModules: 4,
      subCourses: [
        { name: 'Server Maintenance', duration: '55 min', quizzes: 3 },
        {
          name: 'Server Performance Optimization',
          duration: '65 min',
          quizzes: 4,
        },
      ],
    },
  ];
  const data = [
    { category: 'Server', quizzesSolved: 70, incidentsSolved: 60 },
    { category: 'Database', quizzesSolved: 35, incidentsSolved: 60 },
    { category: 'Network', quizzesSolved: 35, incidentsSolved: 40 },
    { category: 'Software', quizzesSolved: 75, incidentsSolved: 80 },
  ];
  const agents = [
    { name: 'Alex James', completionRate: 95, avgQuizScore: 9.4 },
    { name: 'Mike Shaft', completionRate: 75, avgQuizScore: 9.3 },
    { name: 'Kevin Frox', completionRate: 66, avgQuizScore: 9.3 },
    { name: 'Tron Miles', completionRate: 45, avgQuizScore: 9.2 },
  ];
  const categories = ['Server', 'Database', 'Network', 'Software'];
  const AHTagents = [
    { name: 'Alex James', aht: '2:15', lastSixMonths: [1, 2, 1.5, 3, 2, 2.5] },
    {
      name: 'Mike Shaft',
      aht: '4:17',
      lastSixMonths: [1.5, 2.5, 2, 3, 2.5, 8],
    },
    { name: 'Kevin Frox', aht: '2:00', lastSixMonths: [2, 1, 2.5, 2, 3, 2.5] },
    { name: 'Tron Miles', aht: '3:15', lastSixMonths: [1, 2, 3, 2.5, 2, 3] },
  ];
  const overallProgressData = {
    overallProgress: 45,
    level: 'Intermediate',
    totalLearners: 248,
    lessonsCompleted: 80,
    avgCompletionRate: 72,
  };
  const recommendations = [
    {
      type: 'quiz',
      quizzes: 2,
      title: 'Software Installation Issues',
      description:
        'Learn the common challenges and solutions for failed software installations.',
    },
    {
      type: 'quiz',
      quizzes: 3,
      title: 'Server Downtime Troubleshooting',
      description:
        'Gain insights into diagnosing and resolving server outages efficiently.',
    },
    {
      type: 'quiz',
      quizzes: 1,
      title: 'Database Connectivity Problems',
      description:
        'Understand the root causes of database connection issues and how to fix them.',
    },
    {
      type: 'email',
      quizzes: 1,
      title: 'Resolving Network Configuration Errors',
      description:
        'Practice resolving complex network configuration issues via email simulations.',
    },
  ];
  return (
    <Flex direction="column" className="h-screen">
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Text size="4" weight="medium">
            Trainer Dashboard
          </Text>
          <Button
            size="2"
            className="cursor-pointer"
            onClick={() => router.push('/train-assist/create')}
          >
            <AISparkleButtonIcon />
            Create New Module
          </Button>
        </Flex>
      </Box>
      <Flex
        direction="column"
        className="overflow-hidden bg-gray-100 pl-4 py-4 flex-grow"
      >
        <Flex className="h-full">
          <Flex
            direction="column"
            className="w-1/4 pr-4 h-full overflow-y-auto"
          >
            <MyCourses courses={courses} />
          </Flex>
          <Flex direction="column" className="w-1/2 px-4">
            <Box className="mb-4">
              <ModuleCompletionChart data={data} />
            </Box>
            <Flex className="flex-grow">
              <Box className="w-1/2 pr-2 h-full">
                {/* Ensure equal height and scrolling */}
                <Box className="overflow-y-auto">
                  <TopPerformingAgents
                    agents={agents}
                    categories={categories}
                  />
                </Box>
              </Box>
              <Box className="w-1/2 pl-2 h-full">
                {/* Ensure equal height and scrolling */}
                <Box className="overflow-y-auto">
                  <AHTPerAgent agents={AHTagents} categories={categories} />
                </Box>
              </Box>
            </Flex>
          </Flex>
          <Flex
            direction="column"
            className="w-1/4  bg-white h-full overflow-y-auto -mt-4"
          >
            <Box className="p-4">
              <OverallProgress overallProgressData={overallProgressData} />
              <CreateAISuggestedModules recommendations={recommendations} />
            </Box>
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
}

export default withAuth(TrainerDashboard);
