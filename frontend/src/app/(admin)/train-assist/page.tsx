"use client";

import React from "react";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import withAuth from "components/withAuth";
import AISparkleButtonIcon from "components/icons/AISparkleButtonIcon";
import { useGlobalContext } from "contexts/store";
import { useRouter } from "next/navigation";
import OverallProgress from "./OverallProgress";
import CategoryList from "./CategoryList";
import IncidentList from "./IncidentList";
import UserProfile from "./UserProfile";
import AIRecommendations from "./AIRecommendations";

function Dashboard() {
  const { user, organization } = useGlobalContext();
  const router = useRouter();
  // Hardcoded data
  const categories = [
    {
      name: "Software",
      completedModules: 5,
      totalModules: 10,
      completionPercentage: 50,
    },
    {
      name: "Database",
      completedModules: 3,
      totalModules: 8,
      completionPercentage: 37.5,
    },
    {
      name: "Network",
      completedModules: 7,
      totalModules: 12,
      completionPercentage: 58.33,
    },
    {
      name: "Server",
      completedModules: 4,
      totalModules: 9,
      completionPercentage: 44.44,
    },
    {
      name: "Business Processes",
      completedModules: 2,
      totalModules: 6,
      completionPercentage: 33.33,
    },
  ];

  const incidents = [
    {
      title: "Server Down Issue",
      category: "Server",
      difficulty: "Intermediate",
      description:
        "Learn how to resolve a server down issue quickly by diagnosing the root cause and applying a patch.",
    },
    {
      title: "Network Latency Troubleshooting",
      category: "Network",
      difficulty: "Advanced",
      description:
        "Master the art of troubleshooting network latency issues and optimizing network performance.",
    },
    {
      title: "Software Patch Failure",
      category: "Software",
      difficulty: "Intermediate",
      description:
        "Understand common reasons for software patch failures and how to recover from them.",
    },
    {
      title: "Database Backup Error",
      category: "Database",
      difficulty: "Beginner",
      description:
        "Learn the basics of database backups and how to troubleshoot common backup errors.",
    },
  ];

  const userData = {
    name: "Jane Doe",
    level: "Intermediate",
    overallProgress: 46,
    virtualIncidentsCompleted: 10,
    averageScore: 8,
    quizzesTaken: 8,
  };

  const recommendations = [
    {
      title: "Call Simulation",
      subtitle: "Works review",
      description: "Learn how to handle customer calls effectively",
    },
    {
      title: "Take Quiz",
      subtitle: "Database Migration Best Practices",
      description: "Test your knowledge on database migration techniques",
    },
    {
      title: "Complete Course",
      subtitle: "Network Troubleshooting Basics",
      description: "Master the fundamentals of network troubleshooting",
    },
    {
      title: "Email Simulation",
      subtitle: "Customer Support Emails",
      description: "Practice writing professional support emails",
    },
  ];

  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Text size="5" weight="medium">
            {JSON.parse(organization?.config || "{}").Modules?.train_assist
              ?.name ?? "Train Assist"}
          </Text>
          {user?.role === "Admin" && (
            <Button
              size="2"
              className="cursor-pointer"
              onClick={() => router.push("/train-assist/dashboard")}
            >
              <AISparkleButtonIcon />
              Trainer Dashboard
            </Button>
          )}
        </Flex>
      </Box>
      <Flex dir="col" className="bg-gray-100 min-h-0 flex-1">
        <Box p="8" className="overflow-y-auto">
          <Flex gap="8">
            <Box style={{ flex: "1" }}>
              <Text size="7" weight="medium" color="gray">
                Overall Progress
              </Text>
              <OverallProgress
                progress={userData.overallProgress}
                level={userData.level}
              />
              <CategoryList categories={categories} />
            </Box>
            <Box style={{ flex: "2" }}>
              <IncidentList incidents={incidents} />
            </Box>
          </Flex>
        </Box>
        <Box className="bg-white p-6 border-l overflow-y-auto">
          <UserProfile userData={userData} />
          <AIRecommendations recommendations={recommendations} />
        </Box>
      </Flex>
    </Flex>
  );
}

export default withAuth(Dashboard);
