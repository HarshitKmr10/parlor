'use client';

import React, { useEffect, useState } from 'react';
import { CreateSessionButton } from './CreateSessionButton';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useGlobalContext } from 'contexts/store';
import { Box, Button, Flex, Text } from '@radix-ui/themes';
import { SessionCard } from './SessionCard';
import { createSessionApi, getSessionsApi, Session } from 'api/sessions';
import { ArrowLeftIcon } from 'lucide-react';

export const SessionsSidebar: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const { organization } = useGlobalContext();
  const router = useRouter();
  const { appId, sessionId } = useParams();

  const searchParams = useSearchParams();
  const appName = searchParams.get('appName');


  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        if (!appId) {
          console.error('Error fetching initial data:');
          return;
        }
        const fetchedSessions = await getSessionsApi(appId as string);
        setSessions(fetchedSessions);
        
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchSessionData();
  }, [organization, appId, sessionId]);

  const onCreateSession = async (
    name: string,
    type: string,
    options?: { integrationIds?: string[]; sessionOrigin?: string; sessionVisibility?: string, related_record_type?: 'adhoc' | 'change' | 'incident' },
  ) => {
    const newSession = await createSessionApi(name, type, appId as string, options);
    setSessions([...sessions, newSession]);
    if (newSession) {
      router.push(`/apps/${appId}/${newSession.id}?appName=${appName}&isSession=true`);
    }
  };

  const onSelectSession = (incidentId: string) => {
    router.push(`/apps/${appId}/${incidentId}?appName=${appName}&isSession=true`);
  };

  return (
    <Flex direction="column" className="min-h-0 w-full flex-1 border-r border-gray-300 bg-white">
      <Flex
        className="h-14 flex-shrink-0 border-b border-gray-300"
        align="center"
        justify="between"
        px="4"
        gap="4"
      >
        <Button
          variant="ghost"
          color="gray"
          size="1"
          className="cursor-pointer rounded-full"
          onClick={() => router.push(`/apps`)}
        >
          <ArrowLeftIcon />
        </Button>
        <CreateSessionButton onCreateSession={onCreateSession} />
      </Flex>
      <Box className="flex-shrink-0">
          <div className="sticky top-0 z-10 border-b border-t border-[var(--gray-8)] bg-[var(--gray-3)] px-4 py-2">
            <Text size="4">Ad Hocs & Alerts</Text>
          </div>
        </Box>
      <Flex direction="column" gap="2" className="min-h-0 flex-1 overflow-y-auto p-3">
        
        {sessions?.map((session) => (
          <SessionCard key={session.id} session={session} onSelect={onSelectSession} />
        ))}
      </Flex>
    </Flex>
  );
};
