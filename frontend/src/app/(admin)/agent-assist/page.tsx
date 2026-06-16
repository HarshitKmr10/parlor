"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Box, Button, Flex, Tabs, Text } from "@radix-ui/themes";
import { PlusIcon } from "@radix-ui/react-icons";
import { useTranslation } from 'react-i18next';

import Spinner from "components/spinner/spinner";
import withAuth from "components/withAuth";
import { useOrganizationConfig } from "hooks/useOrganizationConfig";
import { useUserDetails } from "hooks/useUserDetails";
import { useChatMessages } from "hooks/useChatMessages";
import { useEmployeeTickets } from "hooks/useEmployeeTickets";
import { useDeviceDetails } from "hooks/useDeviceDetails";
import EmployeeDetailsTab from "components/chat/EmployeeDetailsTab";
import SimilarTicketsTab from "components/chat/SimilarTicketsTab";
import AgentAssistChatPage from "components/chat/AgentAssistChatPage";
import { useGlobalContext } from "contexts/store";
import SimilarTickets from "@/components/systemInfo/SimilarTickets";

import { AnimatePresence, motion } from "framer-motion";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import NewChat from "@/components/icons/NewChat";
import SimilarTicketIcon from "@/components/icons/SimilarTicketIcon";
import { serviceDeskInstance } from "@/api/common/axiosInstance";


function AgentAssist() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatID = searchParams.get("chatId");
  const showSideBarParam = searchParams.get("showSideBar");
  const recordParam = searchParams.get("record");
  const sysIdParam = searchParams.get("sys_id");
  const [userSupportGroup, setUserSupportGroup] = useState<string>("");
  const showSideBar =
    showSideBarParam === null ? true : showSideBarParam === "true";
  const previousChatID = useRef(chatID);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("employeeDetails");
  const [similarTickets, setSimilarTickets] = useState<any[]>([]);
  const [showSimilarTicketOverlay, setShowSimilarTicketOverlay] = useState(false);
  const { organization } = useGlobalContext();

  const [incidentId, setIncidentId] = useState<string>("");
  const [incidentDescription, setIncidentDescription] = useState<string>("");
  const [fetchingIncidentId, setFetchingIncidentId] = useState<boolean>(false);
  // Track whether employee ID was explicitly returned by LLM (vs. from previous session)
  const [employeeIdFromLLM, setEmployeeIdFromLLM] = useState<boolean>(false);

  // Normalize both to a single variable: recordNumber
  const recordNumber = recordParam ?? sysIdParam;

  const { user } = useGlobalContext();


  const {
    config,
    loading: configLoading,
    error: configError,
  } = useOrganizationConfig();


  const {
    userDetails,
    loadingUserDetails,
    setUserDetails,
    fetchUserByEmployeeId,
    error: userDetailsError,
  } = useUserDetails(config?.ticketingSystem ?? "");

  const {
    chatMessages,
    loadingChat,
    fetchChatMessages,
    setChatMessages,
  } = useChatMessages(chatID, fetchUserByEmployeeId);
  // Only fetch employee tickets when the LLM has explicitly returned an employee ID
  const { tickets, loadingTickets, error: ticketsError } = useEmployeeTickets(
    employeeIdFromLLM ? (userDetails?.employeeId ?? "") : "",
    config?.ticketingSystem ?? "",
    userDetails
  );
  const {
    deviceDetails,
    loadingDeviceDetails,
    error: deviceDetailsError,
  } = useDeviceDetails(
    userDetails?.email ?? "",
    config?.endpointManagement ?? false,
    config?.endpointSystem ?? ""
  );
  const errors = [
    userDetailsError,
    configError,
    ticketsError,
    deviceDetailsError,
  ].filter(Boolean);

  // Throw the first error if any exist
  if (errors.length > 0) {
    throw errors[0];
  }

  const fetchNoMessage = useCallback(() => {
    setUserDetails({
      fullName: "",
      mobilePhone: "",
      email: "",
      employeeId: "",
    });
    setChatMessages([]);
    setEmployeeIdFromLLM(false); // Reset LLM flag when starting fresh
  }, [setUserDetails]);

  useEffect(() => {
    if (
      previousChatID.current !== chatID &&
      previousChatID.current !== null &&
      chatID !== null
    ) {
      fetchChatMessages();
    }
    previousChatID.current = chatID;
  }, [chatID, fetchChatMessages]);

  useEffect(() => {
    fetchChatMessages(selectedChatId);
    setUserDetails({
      fullName: "",
      mobilePhone: "",
      email: "",
      employeeId: "",
    });
    setEmployeeIdFromLLM(false); // Reset LLM flag when chat changes
  }, [selectedChatId]);

  useEffect(() => {
    if (chatID) {
      fetchChatMessages();
    }
  }, []);

  useEffect(() => {
    // when userdetails start loading
    if (loadingUserDetails) {
      setSelectedTab("employeeDetails");
    }
  }, [loadingUserDetails]);

  useEffect(() => {
    if (chatID === null) fetchNoMessage();
  }, [chatID, fetchNoMessage]);

  const handleTabChange = (newSelectedTabName: string) => {
    setSelectedTab(newSelectedTabName);
  };


  const handleNewChat = () => {
    // Preserve showSideBar and record parameters when creating new chat
    const params = new URLSearchParams();
    if (!showSideBar) {
      params.set("showSideBar", "false");
    }
    if (recordNumber) {
      params.set("record", recordNumber);
    }
    const newChatUrl = params.toString()
      ? `/agent-assist?${params.toString()}`
      : "/agent-assist";
    router.push(newChatUrl);
    setSelectedTab("employeeDetails");
    setSimilarTickets([]);
    setEmployeeIdFromLLM(false); // Reset LLM flag on new chat
  };

  const fetchIncidentId = useCallback(async (recordNumber) => {
    if(recordNumber) {
      setFetchingIncidentId(true);
      try {
        const { data: incidentData } = await serviceDeskInstance.get(`/servicenow/get_incident_by_sys_id?sys_id=${recordNumber}`);
        setIncidentDescription(`${incidentData?.incident?.records[0]?.short_description} : ${incidentData?.incident?.records[0]?.description}`);
        setIncidentId(incidentData?.incident?.records[0].number);
        setUserSupportGroup(incidentData?.support_group);
      } catch (error) {
        console.error('Error fetching chat messages:', error);
      } finally {
        setFetchingIncidentId(false);
      }
    } else {
      setFetchingIncidentId(false);
    }
   
  }, [recordNumber]);

  useEffect(() => {
    if (incidentId === "" && recordNumber) {
      fetchIncidentId(recordNumber);
    } 
  }, [fetchIncidentId, recordNumber, incidentId]);


  const handleRelatedTickets = useCallback((supportTickets) => {
    // Always update - set to empty array if no tickets to clear previous results
    setSimilarTickets(supportTickets && supportTickets.length > 0 ? supportTickets : []);
  }, []);

  if (loadingChat || configLoading) {
    return <Spinner />;
  }

  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Text size="4" weight="medium">
            {JSON.parse(organization?.config || '{}').Modules?.agent_assist?.name ?? t('agent_assist.agentAssist')}
          </Text>

          <Flex gap="2" align="center">
            {/* Desktop View: Keep original button */}
            {showSideBar && (
              <Button size="1" className="hidden cursor-pointer md:flex" onClick={handleNewChat}>
                <PlusIcon />
                {t('agent_assist.newChat')}
              </Button>
            )}

            {/* Edit Icon Button */}
            <Box
              onClick={handleNewChat}
              className={`bg-transparent relative flex h-6 w-6 items-center justify-center ${
                showSideBar ? "md:hidden" : ""
              }`}
            >
              <NewChat className="h-6 w-6" />
            </Box>

            {/* Ticket Icon Button */}

              <Box
                onClick={() => setShowSimilarTicketOverlay(true)}
                className={`bg-transparent relative flex  h-6 w-6 items-center justify-center ${
                  showSideBar ? "md:hidden" : ""
                }`}
              >
                <SimilarTicketIcon className="h-6 w-6" showBadge={similarTickets.length > 0} />
              </Box>
          </Flex>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Box className={showSideBar ? 'w-full sm:w-2/3' : 'w-full'}>
          {!fetchingIncidentId && (
            <AgentAssistChatPage
              chatId={chatID}
              messages={chatMessages}
              employee_id={userDetails?.employeeNumber ||  userDetails?.employeeId || '-'}
              setEmployeeId={(id) => {
                // Mark that employee ID came from LLM response
                if (id && id !== '-' && id.trim() !== '') {
                  setEmployeeIdFromLLM(true);
                }
                setUserDetails((prev) => ({ ...prev, employeeId: id }));
              }}
              version={config?.version_assist || 'v3'}
              handleRelatedTickets={handleRelatedTickets}
              recordNumber={incidentId}
              incidentDescription={incidentDescription}
              userSupportGroup={userSupportGroup}
            />
          )}
        </Box>

        {showSideBar && (
          <Box className="hidden w-1/3 min-w-64 flex-col border-l border-[var(--gray-8)] sm:flex">
            <Tabs.Root
              value={selectedTab}
              onValueChange={handleTabChange}
              className="flex h-full flex-col"
            >
              <Tabs.List className="flex-shrink-0 pt-1">
                {config?.ticketingEnabled && (
                  <Tabs.Trigger className="cursor-pointer" value="employeeDetails">
                    <Text size="1">{t('agent_assist.employeeDetails')}</Text>
                  </Tabs.Trigger>
                )}
                {config?.agentAssistConfig?.relevant_tickets && (
                  <Tabs.Trigger className="cursor-pointer" value="similarTickets">
                    <Text size="1">{t('agent_assist.similarTickets')}</Text>
                  </Tabs.Trigger>
                )}
              </Tabs.List>
              <Box className="flex-grow overflow-hidden">
                {config?.ticketingEnabled && (
                  <EmployeeDetailsTab
                    isDeviceDetailsLoading={loadingDeviceDetails}
                    isUserDetailsLoading={loadingUserDetails}
                    hasEmployeeId={!!userDetails?.employeeId}
                    employeeId={userDetails?.employeeNumber || userDetails?.employeeId || '-'}
                    employeeName={userDetails?.fullName ?? ''}
                    phoneNumber={userDetails?.mobilePhone ?? ''}
                    endpointManagementEnabled={config?.endpointManagement ?? false}
                    email={userDetails?.email ?? ''}
                    hardwareMetrics={deviceDetails}
                    tickets={tickets}
                    isTicketLoading={loadingTickets}
                    useUserId={config?.useUserId ?? false}
                  />
                )}
                {config?.agentAssistConfig?.relevant_tickets && (
                  <SimilarTicketsTab tickets={similarTickets} loading={false} />
                )}  
              </Box>
            </Tabs.Root>
          </Box>
        )}
        <AnimatePresence>
          {showSimilarTicketOverlay && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="fixed inset-0 z-50 flex flex-col bg-white"
            >
              <Flex justify="between" align="center" className="border-b border-gray-200 p-2">
                <Text size="3" weight="medium">
                  {t('agent_assist.similarTickets')}
                </Text>
                <button
                  onClick={() => setShowSimilarTicketOverlay(false)}
                  className="hover:text-black text-gray-500"
                >
                  x
                </button>
              </Flex>
              <Box className="flex-grow overflow-y-auto p-0">
                <SimilarTickets tickets={similarTickets} loading={false} />
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Flex>
      <ToastContainer />
    </Flex>
  );
}

export default withAuth(AgentAssist);
