"use client";

import React, { useEffect, useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import { ArrowLeftIcon } from "lucide-react";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Text,
  ScrollArea,
  Skeleton,
  Spinner
} from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import FullSpinner from "components/spinner/spinner";
import NoDataIcon from "components/icons/no-records";
import useMeetingsKnowledgeTransition from "hooks/useMeetingsKnowledgeTransition";
import KnowledgeMeetingsTable from "components/tables/KnowledgeMeetingsTable";
import JoinFormKnowledgeTransition from "components/forms/JoinFormKnowledgeTransition";
import withAuth from "components/withAuth";
import { useGlobalContext } from "contexts/store";
import RichTextEditor from "components/TipTap/TipTap";
import routes from "routes";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API } from "api";

interface MeetingAnalytics {
  number_of_meetings: number;
  total_duration: number;
  total_number_of_kbs_created: number;
}

function CallLogs() {
  const { t } = useTranslation();
  const { user, organization, selectedTeam } = useGlobalContext();
  const {
    meetings,
    isLoading,
    isLoadingMore,
    error: fetchError,
    localError: intakeMeetingsError,
    hasMore,
    totalCount,
    loadMore,
  } = useMeetingsKnowledgeTransition();
  const [localError, setLocalError] = useState(null);
  const [isKbDialogOpen, setIsKbDialogOpen] = useState(false);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [kbContent, setKbContent] = useState("");
  const [quizContent, setQuizContent] = useState("");
  const [isKbLoading, setIsKbLoading] = useState(false);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    null
  );
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const [
    isKnowledgeJournalDialogOpen,
    setIsKnowledgeJournalDialogOpen,
  ] = useState(false);
  const [knowledgeJournalContent, setKnowledgeJournalContent] = useState("");
  const [isKnowledgeJournalLoading, setIsKnowledgeJournalLoading] = useState(
    false
  );
  const router = useRouter();
  const [analytics, setAnalytics] = useState<MeetingAnalytics>({
    number_of_meetings: 0,
    total_duration: 0,
    total_number_of_kbs_created: 0,
  });
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [isJoinFormOpen, setIsJoinFormOpen] = useState(false);

  useEffect(() => {
    if (intakeMeetingsError) {
      setLocalError(intakeMeetingsError);
    }
    if (meetings && meetings?.length > 0) {
      setLocalError(null);
    }
  }, [meetings, isLoading]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsAnalyticsLoading(true);
      try {
        const response = await API.KnowledgeAI.getKnowledgeAIMeetingAnalytics(
          selectedTeam?.id
        );
        setAnalytics(response.data);
      } catch (error) {
        console.error("Error fetching meeting analytics:", error);
      } finally {
        setIsAnalyticsLoading(false);
      }
    };

    if (selectedTeam?.id && user) {
      fetchAnalytics();
    }
  }, [selectedTeam?.id, user]);

  // Infinite scroll handler
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const scrollThreshold = 100; // Trigger load more when 100px from bottom

      if (
        scrollHeight - scrollTop - clientHeight < scrollThreshold &&
        hasMore &&
        !isLoadingMore &&
        !isLoading
      ) {
        loadMore();
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, isLoading, loadMore]);


  const handleCreateKB = async (meetingId: string) => {
    setIsKbLoading(true);
    setSelectedMeetingId(meetingId);
    setIsKbDialogOpen(true);
    try {
      const response = await API.KnowledgeAI.getKBforTransitionMeeting(meetingId);
      const data = await response.json();
      setKbContent(data);
    } catch (kbError) {
      console.error("Error creating KB:", kbError);
      setKbContent(t('knowledge_assist.failedToLoadKBContent'));
    } finally {
      setIsKbLoading(false);
    }
  };

  const handleGenerateQuiz = async (meetingId: string) => {
    setIsQuizLoading(true);
    setSelectedMeetingId(meetingId);
    setIsQuizDialogOpen(true);
    try {
      const response = await API.KnowledgeAI.getKBQuizforTransitionMeeting(meetingId);
      const data = await response.json();
      setQuizContent(data);
    } catch (quizError) {
      console.error("Error generating quiz:", quizError);
      setQuizContent(t('knowledge_assist.failedToLoadQuizContent'));
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleKnowledgeJournalClick = async () => {
    if (!user || !user.id) {
      console.error("User ID not available");
      return;
    }

    setIsKnowledgeJournalLoading(true);
    setIsKnowledgeJournalDialogOpen(true);
    try {
      const response = await API.KnowledgeAI.getKnowledgeJournal(user.id);
      const data = await response.json();
      setKnowledgeJournalContent(data || t('knowledge_assist.noContentAvailable'));
    } catch (error) {
      console.error("Error fetching Knowledge Journal:", error);
      setKnowledgeJournalContent(
        t('knowledge_assist.failedToLoadKnowledgeJournal')
      );
    } finally {
      setIsKnowledgeJournalLoading(false);
    }
  };

  const handleCloseJoinForm = () => {
    setIsJoinFormOpen(false);
  };

  const renderContent = () => {
    if (isLoading) {
      return <FullSpinner />;
    }

    if (meetings?.length > 0) {
      return (
        <>
          <KnowledgeMeetingsTable
            tableData={meetings}
            onCreateKB={handleCreateKB}
            onGenerateQuiz={handleGenerateQuiz}
            isKbLoading={isKbLoading}
            isQuizLoading={isQuizLoading}
            selectedMeetingId={selectedMeetingId}
            analytics={analytics}
            isAnalyticsLoading={isAnalyticsLoading}
          />
          {isLoadingMore && (
            <Flex justify="center" py="4" className="h-10">
              <Spinner />
            </Flex>
          )}
          {!hasMore && meetings.length > 0 && (
            <Flex justify="center" py="4">
              <Text size="2" color="gray">
                {totalCount > 0 
                  ? `Showing all ${meetings.length} of ${totalCount} meetings`
                  : t('knowledge_assist.allMeetingsLoaded', 'All meetings loaded')}
              </Text>
            </Flex>
          )}
        </>
      );
    }

    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        gap="4"
        className="h-full py-8"
      >
        <NoDataIcon />
        <Text size="5" weight="medium" color="gray">
          {t('knowledge_assist.noMeetingsFound')}
        </Text>
        <Text size="2" color="gray">
          {t('knowledge_assist.clickNewMeetingToStart')}
        </Text>
      </Flex>
    );
  };

  if (fetchError) {
    throw Error(fetchError);
  }

  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0 ">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Flex align="center" gap="2">
            <ArrowLeftIcon
              className="cursor-pointer"
              onClick={() => router.push("/knowledge/dashboard")}
            />
            <Text size="4" weight="medium">
              {JSON.parse(organization?.config || "{}").Modules
                ?.knowledge_assist?.name ??
                routes.find((route) => route.path === "/knowledge/logs")
                  ?.name ??
                "Knowledge AI"}
            </Text>
          </Flex>
          <Flex gap="2">
            <Link href="/knowledge/dashboard" passHref>
              <Button size="2" className="cursor-pointer" variant="outline">
                {t('knowledge_assist.knowledgeAssist')}
              </Button>
            </Link>
            <Dialog.Root open={isJoinFormOpen} onOpenChange={setIsJoinFormOpen}>
              <Dialog.Trigger>
                <Button size="2" className="cursor-pointer">
                  <PlusIcon />
                  {t('knowledge_assist.newMeeting')}
                </Button>
              </Dialog.Trigger>
              <Dialog.Content>
                <JoinFormKnowledgeTransition onClose={handleCloseJoinForm} />
              </Dialog.Content>
            </Dialog.Root>
          </Flex>
        </Flex>
      </Box>
      <Box 
        ref={scrollContainerRef}
        className="px-2 overflow-y-auto"
      >
        {renderContent()}
      </Box>

      <Dialog.Root open={isKbDialogOpen} onOpenChange={setIsKbDialogOpen}>
        <Dialog.Content
          style={{
            maxWidth: 600,
            height: "80vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Dialog.Title>{t('knowledge_assist.createNewDocument')}</Dialog.Title>

          <ScrollArea style={{ flex: 1 }}>
            <Box p="2">
              {isKbLoading ? (
                <Flex direction="column" gap="2">
                  <Skeleton style={{ width: "80%", height: "24px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "90%", height: "16px" }} />
                  <Skeleton style={{ width: "80%", height: "16px" }} />
                </Flex>
              ) : (
                <RichTextEditor
                  content={kbContent.trim()}
                  onChange={setKbContent}
                />
              )}
            </Box>
          </ScrollArea>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t('knowledge_assist.cancel')}
              </Button>
            </Dialog.Close>
            <Button disabled={isKbLoading}>
              {isKbLoading ? t('knowledge_assist.creating') : t('knowledge_assist.createDocument')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
        <Dialog.Content
          style={{
            maxWidth: 600,
            height: "80vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Dialog.Title>{t('knowledge_assist.generatedQuiz')}</Dialog.Title>

          <ScrollArea style={{ flex: 1 }}>
            <Box p="2">
              {isQuizLoading ? (
                <Flex direction="column" gap="2">
                  <Skeleton style={{ width: "80%", height: "24px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "90%", height: "16px" }} />
                  <Skeleton style={{ width: "80%", height: "16px" }} />
                </Flex>
              ) : (
                <RichTextEditor
                  content={quizContent.trim()}
                  onChange={setQuizContent}
                />
              )}
            </Box>
          </ScrollArea>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t('knowledge_assist.close')}
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root
        open={isKnowledgeJournalDialogOpen}
        onOpenChange={setIsKnowledgeJournalDialogOpen}
      >
        <Dialog.Content
          style={{
            maxWidth: 600,
            height: "80vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Dialog.Title>{t('knowledge_assist.knowledgeJournal')}</Dialog.Title>

          <ScrollArea style={{ flex: 1 }}>
            <Box p="0">
              {isKnowledgeJournalLoading ? (
                <Flex direction="column" gap="2">
                  <Skeleton style={{ width: "80%", height: "24px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "90%", height: "16px" }} />
                  <Skeleton style={{ width: "80%", height: "16px" }} />
                </Flex>
              ) : (
                <RichTextEditor
                  content={knowledgeJournalContent}
                  onChange={setKnowledgeJournalContent}
                />
              )}
            </Box>
          </ScrollArea>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t('knowledge_assist.close')}
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}

export default withAuth(CallLogs);
