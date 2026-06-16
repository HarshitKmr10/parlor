import { Badge, Flex, Text, Tooltip } from '@radix-ui/themes';

export interface IncidentTicket {
    incident_number: string;
    incident_title: string;
    category: string;
}

export const IncidentGroup = ({
    incidentTickets = []
}: {
  incidentTickets?: IncidentTicket[];
}) => {
  if (!incidentTickets?.length) return null;

  const displayIncidents = incidentTickets?.slice(0, 2);
  const remainingCount = incidentTickets?.length > 2 ? incidentTickets?.length - 2 : 0;

  const TooltipContent = () => {
    return (
      <Flex direction="column" gap="2" className="mx-2 my-2 overflow-hidden dark">
        <Flex direction="column" gap="1" className="max-h-[140px] overflow-y-auto">
          {incidentTickets.map((item) => (
            <Flex key={item.incident_number} gap="1" align="center" display="inline-flex">
              <Text wrap="nowrap" className="text-coolGrey-700">
                <Badge
                  radius="large"
                  className="mr-1 border-1 border-coolGrey-200 bg-coolGrey-50 text-coolGrey-600"
                >
                  <div className="h-2 w-2 shrink-0 rounded-full bg-iris-11" />
                  {item.incident_number}
                </Badge>
                {item.incident_title}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Flex>
    );
  };

  return (
    <Tooltip
      content={<TooltipContent />}
      className="customTooltip rounded-md border-1 bg-white shadow-sm"
    >
      <div className="inline-flex items-center">
        <div className="flex items-center gap-1.5 -space-x-20 rounded-md py-1 pl-2 pr-2">
          {/* Additional KBs overlapping */}
          {displayIncidents.map((item, index) => (
            <Badge
              key={index}
              variant="outline"
              color="gray"
              className="bg-white text-xs"
              radius="medium"
            >
             {index === 0 && <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--iris-11)]" />}
              {item.incident_number}
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