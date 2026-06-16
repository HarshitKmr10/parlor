import { Badge, Button, Flex, Text, Tooltip } from '@radix-ui/themes';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface KbTicket {
  id: string;
  name?: string;
  number?: string;
  score?: number;
  title: string;
  access_url: string;
}

export const KBsGroup = ({
  kbTickets = [],
  articleId,
  articleName,
  isMerging,
  onMergeDocuments,
}: {
  kbTickets: KbTicket[];
  articleId?: string;
  articleName?: string;
  isMerging?: boolean;
  onMergeDocuments?: (articleId: string, articleName: string, KbTickets: KbTicket[]) => void;
}) => {
  const { t } = useTranslation();
  
  if (!kbTickets?.length) return null;

  const displayKBs = kbTickets?.slice(0, 3);
  const remainingCount = kbTickets?.length > 3 ? kbTickets?.length - 3 : 0;

  const TooltipContent = () => {
    return (
      <Flex direction="column" gap="2" className="mx-2 my-2 overflow-hidden dark">
        <Flex direction="column" gap="1" className="max-h-[140px] overflow-y-auto">
          {kbTickets.map((kb) => (
            <Flex key={kb.id} gap="1" align="center" display="inline-flex">
              <Text wrap="nowrap" className="text-coolGrey-700">
                <Badge
                  radius="large"
                  className="mr-1 border-1 border-coolGrey-200 bg-coolGrey-50 text-coolGrey-600"
                >
                  <div className="h-2 w-2 shrink-0 rounded-full bg-iris-11" />
                  {/* {truncateId(kb.id)} */}
                  {truncateId(kb.number ?? kb.id)}
                  {/* {kb.number} */}
                </Badge>
                {kb?.name ?? kb.title}
              </Text>
            </Flex>
          ))}
        </Flex>
        {!!onMergeDocuments && (
          <Flex align="center" justify="center">
            {isMerging ? (
              <Button
                size="1"
                variant="soft"
                radius="medium"
                className="flex cursor-pointer flex-row gap-2"
                disabled
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('knowledge_assist.merging')}</span>
              </Button>
            ) : (
              <Button
                size="1"
                variant="soft"
                radius="medium"
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onMergeDocuments(articleId, articleName, kbTickets);
                }}
              >
{t('knowledge_assist.mergeDocuments')}
              </Button>
            )}
          </Flex>
        )}
      </Flex>
    );
  };

  return (
    <Tooltip
      content={<TooltipContent />}
      className="customTooltip rounded-md border-1 bg-white shadow-sm"
    >
      <div 
        className="inline-flex items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 -space-x-6 rounded-md py-1 pl-2 pr-2">
          {/* Additional KBs overlapping */}
          {displayKBs.map((kb, index) => (
            <Badge
              key={index}
              variant="outline"
              color="gray"
              className="bg-white text-xs"
              radius="medium"
            >
              {index === 0 && <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--iris-11)]" />}
              {/* {truncateId(kb.id)} */}
              {truncateId(kb.number ?? kb.id)}
              {/* {kb.number} */}
            </Badge>
          ))}
        </div>
        {remainingCount > 0 && (
          <span className="text-xs font-medium text-[var(--accent-11)]">+{remainingCount}</span>
        )}
      </div>
    </Tooltip>
  );
};

const truncateId = (id: string) => {
  if (!id) return '';
  if (id.length <= 12) return id;
  return `${id.slice(0, 4)}..${id.slice(-4)}`;
};
