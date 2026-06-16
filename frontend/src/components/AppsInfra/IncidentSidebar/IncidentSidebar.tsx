'use client';

// ─── React and Next.js Imports ───────────────────────────────────────
import React from 'react';
import { useParams, useRouter } from 'next/navigation';

// ─── UI Components ───────────────────────────────────────────────────
import { Box, Button, Flex, Text } from '@radix-ui/themes';
import { ArrowLeftIcon } from 'lucide-react';

// ─── Hooks and Custom Components ─────────────────────────────────────
import AppSessionCard from '../AppSessionCard';
import { useAppsInfraStore } from 'store/AppAndInfra/AppInfra';

// ─── Component ───────────────────────────────────────────────────────
const IncidentSessionsSidebar: React.FC = () => {
  const { incidentId } = useParams();
  const router = useRouter();

  const incidentSessions = useAppsInfraStore((s) => s.incidentSessions);
  const incidentSessionLoading = useAppsInfraStore((s) => s.incidentSessionLoading);

  const handleSessionSelect = (
    sessionId: string,
    sessionName: string,
    appName: string,
    appId: string,
  ) => {
    router.push(
      `/apps/incidents/${incidentId}/${sessionId}?sessionName=${sessionName}&appName=${appName}&appId=${appId}`,
    );
  };

  return (
    <Flex direction="column" className="min-h-0 w-full flex-1 border-r border-gray-300 bg-white">
      {/* Top Bar */}
      <Flex className="h-14 flex-shrink-0 border-b border-gray-300" align="center" px="4" gap="2">
        <Button
          variant="ghost"
          color="gray"
          size="1"
          className="cursor-pointer rounded-full"
          onClick={() => router.push(`/apps`)}
        >
          <ArrowLeftIcon />
        </Button>
        <Text weight="bold" size="3">
          {incidentId}
        </Text>
      </Flex>

      {/* Sessions List */}
      <Flex direction="column" gap="2" className="min-h-0 flex-1 overflow-y-auto p-3">
        {incidentSessionLoading && <Text size="2">Loading sessions...</Text>}
        {!incidentSessionLoading && incidentSessions.length === 0 && (
          <Box className="text-center">
            <Text size="2" color="gray" align="center" className="mb-3">
              No sessions found for this incident.
            </Text>
            <br />
          </Box>
        )}
        {incidentSessions.map((session) => (
          <AppSessionCard
            key={session.id}
            session={session}
            onSelect={(appId) =>
              handleSessionSelect(session.id, session.name, session?.app?.name, appId)
            }
          />
        ))}
      </Flex>
    </Flex>
  );
};

export default IncidentSessionsSidebar;
