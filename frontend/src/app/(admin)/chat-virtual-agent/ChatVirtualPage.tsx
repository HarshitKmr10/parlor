import {
  Flex,
  Text,
  Badge,
  Box,
  IconButton,
  Tabs,
  Card,
  Grid,
  Button,
  Spinner,
} from "@radix-ui/themes";
import React, { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import CustomAvatar from "components/CustomAvatar";
import { formatDate } from "utils/dateUtils";
import {
  CopyIcon,
  ClockIcon,
  CalendarIcon,
  PersonIcon,
  Link2Icon,
} from "@radix-ui/react-icons";
import moment from "moment";
import AIChatIcon from "components/icons/AIChatIcon";
import { ChatVirtualConversation } from "api/chatVirtualAgent";
import RealTimeChatTranscript from "./RealTimeChatTranscript";

interface Message {
  role: string;
  content: string;
}

interface ChatVirtualConversationProps {
  selectedConversation: ChatVirtualConversation;
  websocketText: Message[];
  interactionDetails: any;
  isInteractionLoading: boolean;
}

const InteractionDetails = ({ details }) => {
  const { t } = useTranslation();
  
  const getStateColor = (state) => {
    const stateColors = {
      closed_abandoned: "red",
      ongoing: "green",
      closed: "blue",
    };
    return stateColors[state] || "gray";
  };

  const formatDuration = (durationStr) => {
    if (!durationStr) return "N/A";
    const date = new Date(durationStr);
    return `${date.getUTCHours()}h ${date.getUTCMinutes()}m ${date.getUTCSeconds()}s`;
  };

  // Extract instance from any available link
  const instanceUrl = details.opened_by?.link || "";
  const instance =
    instanceUrl.match(/https:\/\/(.*?)\.service-now\.com/)?.[1] || "";

  const getUserLink = (userId) => {
    if (!userId || !instance) return "#";
    return `https://${instance}.service-now.com/nav_to.do?uri=sys_user.do?sys_id=${userId}`;
  };

  const UserLink = ({ name, sysId }) => {
    const { t } = useTranslation();
    return (
      <Button
        variant="ghost"
        className="p-0 hover:underline"
        onClick={() => window.open(getUserLink(sysId))}
      >
        {name || t('chat_virtual_agent.unknownUser')}
      </Button>
    );
  };

  return (
    <Box className="p-4 space-y-6">
      <Card className="p-4">
        <Grid columns="2" gap="4">
          {/* Header Information */}
          <Box className="col-span-2">
            <Flex justify="between" align="center">
              <Flex gap="2" align="center">
                <Text size="4" weight="bold">
                  {t('chat_virtual_agent.interaction')} {details.number}
                </Text>
                <Badge color={getStateColor(details.state)}>
                  {details.state.replace("_", " ")}
                </Badge>
                {details.state_reason && (
                  <Badge variant="outline">
                    {t('chat_virtual_agent.reason')}: {details.state_reason.replace("_", " ")}
                  </Badge>
                )}
              </Flex>
              <Button
                variant="soft"
                onClick={() =>
                  window.open(
                    `https://${instance}.service-now.com/nav_to.do?uri=interaction.do?sys_id=${details.sys_id}`
                  )
                }
                size="1"
              >
                <Link2Icon className="mr-1" />
                {t('chat_virtual_agent.openInServiceNow')}
              </Button>
            </Flex>
          </Box>

          {/* Timing Information */}
          <Card className="p-4">
            <Flex direction="column" gap="2">
              <Flex align="center" gap="2">
                <CalendarIcon />
                <Text weight="bold" size="2">
                  {t('chat_virtual_agent.opened')}
                </Text>
                <Text size="2" color="gray">
                  {formatDate(details.opened_at)}
                </Text>
              </Flex>
              <Flex align="center" gap="2">
                <CalendarIcon />
                <Text weight="bold" size="2">
                  {t('chat_virtual_agent.closed')}
                </Text>
                <Text size="2" color="gray">
                  {formatDate(details.closed_at)}
                </Text>
              </Flex>
              <Flex align="center" gap="2">
                <ClockIcon />
                <Text weight="bold" size="2">
                  {t('chat_virtual_agent.duration')}
                </Text>
                <Text size="2" color="gray">
                  {formatDuration(details.duration)}
                </Text>
              </Flex>
            </Flex>
          </Card>

          {/* User Information */}
          <Card className="p-4">
            <Flex direction="column" gap="2">
              <Flex align="center" gap="2">
                <PersonIcon />
                <Text weight="bold" size="2">
                  {t('chat_virtual_agent.openedBy')}
                </Text>
                <UserLink
                  name={details["opened_by.name"]}
                  sysId={details["opened_by.sys_id"]}
                />
              </Flex>
              <Flex align="center" gap="2">
                <PersonIcon />
                <Text weight="bold" size="2">
                  {t('chat_virtual_agent.assignedTo')}
                </Text>
                {details["assigned_to.sys_id"] ? (
                  <UserLink
                    name={details["assigned_to.name"]}
                    sysId={details["assigned_to.sys_id"]}
                  />
                ) : (
                  <Text>{t('chat_virtual_agent.unassigned')}</Text>
                )}
              </Flex>
              <Flex align="center" gap="2">
                <PersonIcon />
                <Text weight="bold" size="2">
                  {t('chat_virtual_agent.openedFor')}
                </Text>
                <UserLink
                  name={details["opened_for.name"]}
                  sysId={details["opened_for.sys_id"]}
                />
              </Flex>
              {details["closed_by.sys_id"] && (
                <Flex align="center" gap="2">
                  <PersonIcon />
                  <Text weight="bold" size="2">
                    {t('chat_virtual_agent.closedBy')}
                  </Text>
                  <UserLink
                    name={details["closed_by.name"]}
                    sysId={details["closed_by.sys_id"]}
                  />
                </Flex>
              )}
            </Flex>
          </Card>

          {/* Status Information */}
          <Card className="p-4 col-span-2">
            <Grid columns="3" gap="4">
              <Flex direction="column" gap="2">
                <Text weight="bold" size="2">
                  {t('chat_virtual_agent.direction')}
                </Text>
                <Badge variant="soft">{details.direction}</Badge>
              </Flex>
              <Flex direction="column" gap="2">
                <Text weight="bold" size="2">
                  {t('chat_virtual_agent.virtualAgent')}
                </Text>
                <Badge
                  variant="soft"
                  color={details.virtual_agent === "true" ? "green" : "gray"}
                >
                  {details.virtual_agent === "true" ? t('chat_virtual_agent.yes') : t('chat_virtual_agent.no')}
                </Badge>
              </Flex>
              <Flex direction="column" gap="2">
                <Text weight="bold" size="2">
                  {t('chat_virtual_agent.helpRequested')}
                </Text>
                <Badge
                  variant="soft"
                  color={details.help_requested === "true" ? "yellow" : "gray"}
                >
                  {details.help_requested === "true" ? t('chat_virtual_agent.yes') : t('chat_virtual_agent.no')}
                </Badge>
              </Flex>
              <Flex direction="column" gap="2">
                <Text weight="bold" size="2">
                  {t('chat_virtual_agent.autoResolution')}
                </Text>
                <Badge
                  variant="soft"
                  color={details.auto_resolution === "true" ? "blue" : "gray"}
                >
                  {details.auto_resolution === "true" ? t('chat_virtual_agent.yes') : t('chat_virtual_agent.no')}
                </Badge>
              </Flex>
              {details.csat_score && (
                <Flex direction="column" gap="2">
                  <Text weight="bold" size="2">
                    {t('chat_virtual_agent.csatScore')}
                  </Text>
                  <Badge variant="soft">{details.csat_score}</Badge>
                </Flex>
              )}
              {details.sentiment && (
                <Flex direction="column" gap="2">
                  <Text weight="bold" size="2">
                    {t('chat_virtual_agent.sentiment')}
                  </Text>
                  <Badge variant="soft">{details.sentiment}</Badge>
                </Flex>
              )}
            </Grid>
          </Card>

          {/* Additional Information */}
          {(details.category ||
            details.subcategory ||
            details.chat_summary) && (
            <Card className="p-4 col-span-2">
              <Flex direction="column" gap="4">
                {details.category && (
                  <Flex direction="column" gap="1">
                    <Text weight="bold" size="2">
                      {t('chat_virtual_agent.category')}
                    </Text>
                    <Text size="2">{details.category}</Text>
                  </Flex>
                )}
                {details.subcategory && (
                  <Flex direction="column" gap="1">
                    <Text weight="bold" size="2">
                      {t('chat_virtual_agent.subcategory')}
                    </Text>
                    <Text size="2">{details.subcategory}</Text>
                  </Flex>
                )}
                {details.chat_summary && (
                  <Flex direction="column" gap="1">
                    <Text weight="bold" size="2">
                      {t('chat_virtual_agent.chatSummary')}
                    </Text>
                    <Text size="2">{details.chat_summary}</Text>
                  </Flex>
                )}
              </Flex>
            </Card>
          )}
        </Grid>
      </Card>
    </Box>
  );
};

function ChatVirtualPage({
  selectedConversation,
  websocketText,
  interactionDetails,
  isInteractionLoading,
}: ChatVirtualConversationProps) {
  const { t } = useTranslation();
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [websocketText]);

  const messages =
    selectedConversation.status === "ongoing"
      ? websocketText
      : selectedConversation.messages;

  const duration = moment.duration(
    moment(selectedConversation.updated_at).diff(
      moment(selectedConversation.created_at)
    )
  );

  const durationStr =
    selectedConversation.status === "ongoing"
      ? t('chat_virtual_agent.inProgress')
      : `${duration
          .minutes()
          .toString()
          .padStart(2, "0")}:${duration.seconds().toString().padStart(2, "0")}`;

  return (
    <Flex direction="column" className="h-full w-full">
      <Box className="flex-shrink-0 p-1">
        <Flex
          align="center"
          justify="between"
          className="items-center h-full"
          gapX="2"
        >
          <Flex
            align="center"
            className="items-center h-full"
            px="4"
            ml="-2"
            gapX="2"
          >
            <AIChatIcon />
            <Text weight="bold" size="2" color="gray">
              {selectedConversation.user_details.user_name || t('chat_virtual_agent.unknownUser')}
            </Text>
            <Badge>
              {t('chat_virtual_agent.userId')} {selectedConversation.user_details.azure_object_id}
            </Badge>
            <Text size="1" color="gray">
              {formatDate(selectedConversation.created_at)}
            </Text>
          </Flex>
        </Flex>
      </Box>

      <Box className="flex-shrink-0">
        <Flex
          direction="column"
          align="center"
          justify="center"
          className="items-center h-full border-b border-[var(--gray-8)] bg-[var(--gray-11)] w-full"
          px="4"
          py="4"
          gapX="2"
          gapY="6"
        >
          <Flex gapX="2" className="w-full">
            <CustomAvatar
              alt="image"
              src={null}
              name={
                selectedConversation.user_details.user_name || t('chat_virtual_agent.unknownUser')
              }
            />
            <Box className="w-full space-y-1">
              <Flex
                gapX="2"
                gapY="7"
                align="center"
                justify="between"
                className="w-full"
              >
                <Flex align="center" gapX="2">
                  <Text as="div" size="2" weight="bold" className="text-white">
                    {selectedConversation.user_details.user_name}
                  </Text>
                  <Flex gapX="1">
                    <IconButton
                      size="1"
                      aria-label={t('chat_virtual_agent.copyUserId')}
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          selectedConversation.user_details.azure_object_id
                        );
                      }}
                    >
                      <CopyIcon className="text-white" />
                    </IconButton>
                    <Text
                      as="div"
                      size="1"
                      weight="regular"
                      className="text-white"
                    >
                      {t('chat_virtual_agent.userId')}
{' '}
                      {`${selectedConversation.user_details.azure_object_id?.slice(
                        0,
                        8,
                      )
                      }...${
                        selectedConversation.user_details.azure_object_id?.slice(
                          -8,
                        )}`}
                    </Text>
                  </Flex>
                </Flex>
              </Flex>
              <Flex gapX="2" align="center" className="w-full">
                <Text as="div" size="1" weight="medium" className="text-white">
                  <span className="font-bold">{t('chat_virtual_agent.status')} </span>
                  {selectedConversation.status}
                </Text>
                <Text as="div" size="1" weight="medium" className="text-white">
                  <span className="font-bold">{t('chat_virtual_agent.duration')} </span>
                  {durationStr}
                </Text>
              </Flex>
            </Box>
          </Flex>
        </Flex>
      </Box>

      <Box className="flex-grow overflow-hidden">
        <Tabs.Root defaultValue="conversation" className="flex flex-col h-full">
          <Box className="flex-shrink-0 bg-[var(--color-background)]">
            <Tabs.List>
              <Tabs.Trigger value="conversation">{t('chat_virtual_agent.conversation')}</Tabs.Trigger>
              <Tabs.Trigger value="details">{t('chat_virtual_agent.interactionDetails')}</Tabs.Trigger>
            </Tabs.List>
          </Box>
          <Box className="flex-grow overflow-hidden">
            <Tabs.Content
              value="conversation"
              className="h-full overflow-y-auto bg-[var(--color-background)]"
            >
              <Box className="flex-grow overflow-y-auto">
                {messages.map((message, index) => (
                  <RealTimeChatTranscript
                    key={index}
                    content={message.content}
                    userName={selectedConversation.user_details.user_name}
                    role={message.role}
                    extra={message.isPartial ? "opacity-70" : ""}
                  />
                ))}
              </Box>
              <div ref={transcriptEndRef} />
            </Tabs.Content>
            <Tabs.Content
              value="details"
              className="h-full overflow-y-auto bg-[var(--color-background)]"
            >
              {isInteractionLoading ? (
                <Spinner />
              ) : (
                <InteractionDetails details={interactionDetails} />
              )}
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Box>
    </Flex>
  );
}

export default ChatVirtualPage;
