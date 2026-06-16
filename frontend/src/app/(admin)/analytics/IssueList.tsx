import { Box, Flex, Text } from '@radix-ui/themes';
import { FC } from 'react';

interface Issues {
  title: string;
  list: { id: string; name: string }[];
  remainingCount: number;
}

interface IssueListProps {
  issues: Issues[];
  className?: string;
}

const IssueList: FC<IssueListProps> = ({ issues, className }) => (
  <Flex direction="column" gap="4" className={`rounded-lg bg-white p-6 ${className}`}>
    <Text size="4" weight="medium">
      Recurring Issues
    </Text>
    <Flex direction="row" gap="2" align="center" justify="between">
      <Text size="2" color="gray">
        Incident Name
      </Text>
      <Text size="2" color="gray">
        Occurance Count
      </Text>
    </Flex>
    <Flex direction="column">
      {issues.map((issue, index) => {
        const topThreeIssuesTickets = issue.list.slice(0, 3);
        return (
          <Flex
            key={index}
            direction="row"
            gap="5"
            align="center"
            justify="between"
            className="overflow-hidden border-t border-gray-200 py-2"
          >
            <Text size="2" truncate>
              {issue.title}
            </Text>

            <Flex direction="row" align="center" gap="1">
              <Flex
                gap="2"
                align="center"
                position="relative"
                style={{ width: `${topThreeIssuesTickets.length * 35 + 25}px` }}
              >
                {topThreeIssuesTickets.slice(0, 4).map((item, index) => (
                  <Flex
                    key={index}
                    direction="row"
                    align="center"
                    position="absolute"
                    style={{
                      right: `${index * 30}px`,
                    }}
                    className="cursor-pointer rounded-md border gap-2 border-gray-200 bg-[#FBFBFB] px-2 transition-all duration-100 hover:z-50 hover:scale-105 hover:bg-gray-200 hover:shadow-md"
                  >
                    {/* // TODO: replace with ticket link */}
                    {/* <a
                      target="_blank"
                      href={`/admin/agent-assist/incident/${item.id}`}
                      className="flex items-center gap-2 no-underline"
                    > */}
                      <Box className="h-2 w-3 rounded-full bg-[#5B5BD6]" />
                      <Text size="2">{item.id}</Text>
                    {/* </a> */}
                  </Flex>
                ))}
              </Flex>
              {!!issue.remainingCount && (
<Text size="2">
+
{issue.remainingCount}
</Text>
              )}
            </Flex>
          </Flex>
        );
      })}
    </Flex>
  </Flex>
);

export default IssueList;
