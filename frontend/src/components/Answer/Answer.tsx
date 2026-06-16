import React, { useMemo } from "react";
import { useGlobalContext } from "contexts/store";
import useReactionsAndInteractions from "hooks/useReactionsAndInteractions";
import { ChatAppResponse } from "api/chat/models";
import { Box, Button, Flex, Text } from "@radix-ui/themes";

import { stringUtils } from "utils/stringUtils";
import AIChatIcon from "components/icons/AIChatIcon";
import { BiDislike, BiLike } from "react-icons/bi";
import { RiFileCopyLine } from "react-icons/ri";
import clsx from "clsx";
import MarkDownText from "components/MarkDownText/MarkDownText";
import { parseAnswerToHtml } from "./AnswerParser";
import { serviceDeskInstance } from "api/common/axiosInstance";
import { Brain } from "lucide-react";

interface Props {
  answer: ChatAppResponse | any;
  isStreaming: boolean;
  onCitationClicked: (filePath: string) => void;
  assistantName: string;
  session_id?: string;
  app_id?: string;
  showReactionsEvenWhenNotHovered?: boolean;
  latestQuickReplies?: string[];
  onSend?: (question: string) => void;
  userSupportGroup?: string;
}

export const Answer = React.memo(function Answer({
  answer,
  isStreaming,
  onCitationClicked,
  assistantName,
  session_id,
  app_id,
  showReactionsEvenWhenNotHovered = false,
  latestQuickReplies,
  onSend,
  userSupportGroup,
}: Props) {
  const { user } = useGlobalContext();
  let citations = [];
  let messageContent = "";

  const hideReactions = process.env.NEXT_PUBLIC_CLIENT === "PROFILE_GD";

  if (answer && answer.choices) {
    citations = answer.choices[0].context.citations;
    messageContent = answer.choices[0].message.content;
  } else if (answer && answer.data) {
    citations = answer.data?.response_aids?.citations;
    messageContent = answer.data?.response_message_content?.assistant;
  }

  const parsedAnswer = useMemo(
    () => parseAnswerToHtml(messageContent, isStreaming),
    [messageContent, isStreaming, user?.org_id]
  );

  // Get predicted assignment group from response_aids
  const predictedAssignmentGroup = useMemo(() => {
    // First try to get predicted_assignment_group from response_aids
    const predictedAG = answer?.data?.response_aids?.predicted_assignment_group;
    if (predictedAG) {
      return predictedAG;
    }
    
  //   // Fallback to most_common_resolver_group if no predicted assignment group available
  //   const mostCommonResolver = answer?.data?.response_aids?.most_common_resolver_group?.most_common_resolver_group;
  //   return mostCommonResolver;
  }, [answer?.data?.response_aids]);

  const resolverToDisplay = useMemo(() => {
    if (!predictedAssignmentGroup || predictedAssignmentGroup === "N/A") {
      return null;
    }
    
    // If predictedAssignmentGroup starts with "SS - " or "IMAC", use userSupportGroup instead
    if (predictedAssignmentGroup.startsWith("SS - ") || predictedAssignmentGroup.startsWith("IMAC")) {
      return userSupportGroup || predictedAssignmentGroup;
    }
    
    return predictedAssignmentGroup;
  }, [predictedAssignmentGroup, userSupportGroup]);

  
  const {
    reaction,
    toggleThumbsUp,
    toggleThumbsDown,
  } = useReactionsAndInteractions();

  const handleSubmit = async (react: boolean) => {
    const jsonData = {
      session_id: session_id,
      reaction: react,
      message: parsedAnswer.answerHtml,
      app_id: app_id,
      message_id: answer.data.response_aids.message_id,
    };

    try {
      const response = await serviceDeskInstance.post(
        `/service_desk/report_reaction`,
        jsonData
      );

      if (response.status !== 200) {
        console.error("Failed to send reaction");
      }
    } catch (error) {
      console.error(`Error reporting reaction: ${error}`);
    }
  };

  const handleCitationClick = (citation: {
    name: string;
    url: string;
    source: string;
  }) => {
    window.open(citation.url, "_blank");
  };
  return (
    <div className="group relative flex flex-col items-stretch gap-4 px-2 md:px-2">
      <Box className="border-b border-[var(--accent-3)] py-2 pr-2">
        <Flex gap="2">
          <div className="hidden md:block">
            <AIChatIcon />
          </div>
          <Flex direction="column">
            <Flex gap="2">
              {/* Hide assistant name on mobile */}
              <Text
                size="2"
                weight="bold"
                className="hidden md:block"
                style={{ color: 'var(--pink-9)' }}
              >
                {assistantName}
              </Text>
            </Flex>
            <MarkDownText value={parsedAnswer.answerHtml} />
            {resolverToDisplay &&  (
              <Text size="2" weight="medium" mt={"4"} className="md:text-current block text-[#2957D2]">
                Most Common Resolver: {resolverToDisplay}
              </Text>
            )}
            {citations && citations.length > 0 && (
              <Flex direction="column" className="pt-2" align="start" justify="start">
                <Text size="4">References:</Text>
                <ol className="space-y-2">
                  {citations.map((citation, index) => (
                    <li key={citation.name + index.toString()}>
                      <button
                        className="w-full text-left text-xs font-medium text-[var(--accent-9)] underline underline-offset-2 hover:text-[var(--accent-10)] hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--accent-8)] rounded-sm break-words"
                        title={citation.name}
                        aria-label={`Citation ${index + 1}: ${citation.name}`}
                        onClick={() => handleCitationClick(citation)}
                      >
                        <span className="pr-1 text-[var(--accent-8)]">{index + 1}.</span>
                        {citation.name}
                      </button>
                    </li>
                  ))}
                </ol>
              </Flex>
            )}

            {/* todo need to check if we need this later */}
            {!hideReactions && (
               <Flex
               gap="2"
               className={clsx(
                 'absolute bottom-2 right-2 rounded-md border-1 border-[var(--accent-5)] bg-white px-3 py-1',
                 'origin-bottom-right',
                 'transition-all duration-300',
                 'scale-0',
                 'group-hover:scale-100',
               )}
             >
               <BiLike
                 className={`inline cursor-pointer ${
                   reaction === 'liked' ? 'text-[var(--green-9)]' : 'text-[var(--accent-9)]'
                 }`}
                 onClick={() => {
                   toggleThumbsUp();
                   handleSubmit(true);
                 }}
               />
 
               <BiDislike
                 className={`inline cursor-pointer ${
                   reaction === 'disliked' ? 'text-[var(--red-9)]' : 'text-[var(--accent-9)]'
                 }`}
                 onClick={() => {
                   toggleThumbsDown();
                   handleSubmit(false);
                 }}
               />
 
               <RiFileCopyLine
                 className="inline cursor-pointer text-[var(--accent-9)]"
                 onClick={() => stringUtils.copyToClipboard(messageContent)}
               />
             </Flex>
            )}
           

            {!!latestQuickReplies?.length && (
              <Flex justify="end" mb="-2" gap="2" mt="8" pb="8" className="relative right-0 bottom-0 sm:hidden">
                <Flex direction="column" gap="2" align="end">
                  {latestQuickReplies?.map((reply) => (
                    <Button
                      key={reply}
                      radius="medium"
                      size="1"
                      onClick={() => onSend(reply)}
                      className="w-min cursor-pointer whitespace-nowrap bg-iris-2 px-3 py-1 text-iris-9 hover:bg-iris-3 active:bg-iris-4"
                    >
                      {reply}
                    </Button>
                  ))}
                </Flex>
              </Flex>
            )}
          </Flex>
        </Flex>
      </Box>
    </div>
  );
});
