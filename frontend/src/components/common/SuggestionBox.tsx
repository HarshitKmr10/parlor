import { useMemo } from 'react';
import { useGlobalContext } from 'contexts/store';
import useReactionsAndInteractions from 'hooks/useReactionsAndInteractions';
import { Box, Flex, Text } from '@radix-ui/themes';
import { stringUtils } from 'utils/stringUtils';
import AIChatIcon from 'components/icons/AIChatIcon';
import { BiDislike, BiLike } from 'react-icons/bi';
import { RiFileCopyLine } from 'react-icons/ri';
import MarkDownText from 'components/MarkDownText/MarkDownText';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import SimilarTicketItem from './SimilarTicketItem';
import clsx from 'clsx';

type Props = {
  suggestion: any;
  setActiveCitation: (path: string) => void;
  setShowCitation: (show: boolean) => void;
  parseAnswerToHtml: (
    answer: string,
    isStreaming: boolean,
    org_id: string,
  ) => { answerHtml: string; citations: string[] };
  getCitationFilePath: (citation: string, org_id: string | null) => string;
  moduleName: string;
  session_id: string;
  app_id: string;
};

function SuggestionBox({
  suggestion,
  setActiveCitation,
  setShowCitation,
  parseAnswerToHtml,
  getCitationFilePath,
  moduleName,
  session_id,
  app_id,
}: Props) {
  const { user } = useGlobalContext();
  const { reaction, toggleThumbsUp, toggleThumbsDown } = useReactionsAndInteractions();

  const hideReactions = process.env.NEXT_PUBLIC_CLIENT === 'PROFILE_GD';

  const handleCitationClick = (citation: { name: string; url: string; source: string }) => {
    window.open(citation.url, '_blank');
  };

  const parsedAnswer = useMemo(
    () => parseAnswerToHtml(suggestion.answer, false, user?.org_id),
    [suggestion.answer, user?.org_id],
  );

  const handleSubmit = async (react: boolean) => {
    const jsonData = {
      session_id: session_id,
      reaction: react,
      message: parsedAnswer.answerHtml,
      app_id: app_id,
      message_id: suggestion.messageId,
    };

    try {
      const response = await serviceDeskInstance.post(`/service_desk/report_reaction`, jsonData);

      if (response.status !== 200) {
        console.error('Failed to send reaction');
      }
    } catch (error) {
      console.error(`Error reporting reaction: ${error}`);
    }
  };

  return (
    <div className="group relative flex flex-col items-stretch gap-4 sm:px-0">
      <Box className="border-b border-[var(--accent-3)] py-2 pr-2">
        <Flex gap="2" mt="2">
          <AIChatIcon />
          <Flex direction="column">
            <Flex gap="2">
              <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
                {moduleName}
              </Text>
            </Flex>

            {/* Question */}
            <Text size="2" weight="bold" mt="2" mb="1">
              {suggestion.question}
            </Text>

            {/* Answer */}
            <MarkDownText value={parsedAnswer.answerHtml} />

            {suggestion.citations && suggestion.citations.length > 0 && (
              <Flex direction="column" mb="1" align="start" justify="start">
                <Text size="1" mt="2" weight="bold">
                  Citations:
                </Text>
                {suggestion.citations.map((citation, index) => (
                  <button
                    key={citation}
                    className="bg-transparent w-full cursor-pointer text-wrap break-words border-0 py-1 text-left font-medium text-[var(--accent-9)] no-underline hover:text-[var(--accent-10)] hover:underline"
                    style={{ fontSize: '12px' }}
                    title={citation}
                    onClick={() => handleCitationClick(citation)}
                  >
                    {`${index + 1}. ${citation.name}`}
                  </button>
                ))}
              </Flex>
            )}

            {/* Most Common Resolver Groups */}
            {suggestion?.most_common_resolver_group &&
              suggestion?.most_common_resolver_group?.most_common_resolver_group !== 'N/A' && (
                <Flex
                  gap="1"
                  direction="row"
                  mb="1"
                  align="center"
                  justify="start"
                  className="mt-2"
                >
                  <Text size="1" weight="medium" className="text-[#0D001A]">
                    Most Common Resolver Groups:
                  </Text>
                  <Flex
                    align="center"
                    justify="center"
                    className="h-5 rounded-full bg-iris-13 px-2"
                  >
                    <Text size="1" weight="medium" className="text-[#19213D]">
                      {suggestion.most_common_resolver_group?.most_common_resolver_group || ''}
                    </Text>
                  </Flex>
                </Flex>
              )}

            {/* Similar Tickets */}
            {suggestion.similar_tickets && suggestion.similar_tickets.length > 0 && (
              <Flex direction="column" mb="1" mt="1" align="start" justify="start">
                <Text size="3" mt="2" weight="medium">
                  Similar Tickets
                </Text>
                <div className="mt-1 w-full">
                  {suggestion.similar_tickets.map((ticket, index) => (
                    <SimilarTicketItem key={ticket.sys_id || index} ticket={ticket} />
                  ))}
                </div>
              </Flex>
            )}

            {!hideReactions && (
              <>
                {app_id !== 'vva_suumary' && (
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
                      onClick={() => stringUtils.copyToClipboard(suggestion.answer)}
                    />
                  </Flex>
                )}
              </>
            )}
          </Flex>
        </Flex>
      </Box>
    </div>
  );
}

export default SuggestionBox;
