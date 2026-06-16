import {
  Box, Flex, Text,
} from '@radix-ui/themes';
import HtmlText from 'components/HtmlText/HtmlText';
import AIChatIcon from 'components/icons/AIChatIcon';

interface AnswerLoadingProps {
  assistantName: string;
  useSkeletonLoader?: boolean;
}

export function AnswerLoading({ assistantName, useSkeletonLoader = false }: AnswerLoadingProps) {
  const SkeletonLoader = () => (
    <Flex direction="column" gap="2" className="w-[95%] px-2 md:px-0 min-w-16">
      {[...Array(3)].map((_, index) => (
        <div
          key={index}
          className="loading-skeleton"
          style={{
            width: '100%',
            height: '16px',
            backgroundColor: 'var(--accent-4)',
            borderRadius: 'var(--radius-2)',
          }}
        />
      ))}
    </Flex>
  );

  return (
    <Box className="items-stretch sm:px-0 flex flex-col gap-4">
      <Box className="border-b border-[var(--accent-3)] py-2">
        <Flex gap="2" >
          {/* Hide on mobile */}
          <div className="hidden md:block">
            <AIChatIcon />
          </div>

          <Flex direction="column" className={useSkeletonLoader ? `w-full` : ''}>
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
              {/* <Badge variant="surface">AI Generated</Badge> */}
            </Flex>
            {useSkeletonLoader ? (
              <SkeletonLoader />
            ) : (
              <Flex direction="column" className="w-full px-2 md:px-0">
                <HtmlText value="Please give me a moment..." />
              </Flex>
            )}
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}