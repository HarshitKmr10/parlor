'use client';

import { Box, Flex, Text } from '@radix-ui/themes';
import { ChevronUp, ChevronDown, AlertTriangle, AlertOctagon, Clock3 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { useState } from 'react';
import { useIncidentDetails } from 'hooks/AppsInfra/useIncidentDetails';

const IncidentIdIcon = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="16" height="16" transform="translate(0.416016 0.0129395)" fill="white" fillOpacity="0.01" />
    <path fillRule="evenodd" clipRule="evenodd" d="M15.3493 11.7464V4.27968H1.48268V11.7464H15.3493ZM16.416 4.27968V11.7464C16.416 12.3354 15.9385 12.8131 15.3493 12.8131H1.48268C0.893578 12.8131 0.416016 12.3354 0.416016 11.7464V4.27968C0.416016 3.69058 0.893578 3.21301 1.48268 3.21301H15.3493C15.9385 3.21301 16.416 3.69058 16.416 4.27968ZM2.54935 5.61295C2.54935 5.46567 2.66874 5.34628 2.81602 5.34628H6.54935C6.69662 5.34628 6.81602 5.46567 6.81602 5.61295V10.4129C6.81602 10.5602 6.69662 10.6796 6.54935 10.6796H2.81602C2.66874 10.6796 2.54935 10.5602 2.54935 10.4129V5.61295ZM8.41602 7.47962C8.12147 7.47962 7.88268 7.7184 7.88268 8.01295C7.88268 8.3075 8.12147 8.54628 8.41602 8.54628H11.616C11.9105 8.54628 12.1493 8.3075 12.1493 8.01295C12.1493 7.7184 11.9105 7.47962 11.616 7.47962H8.41602ZM7.88268 10.1463C7.88268 9.85173 8.12147 9.61295 8.41602 9.61295H13.7493C14.0439 9.61295 14.2827 9.85173 14.2827 10.1463C14.2827 10.4408 14.0439 10.6796 13.7493 10.6796H8.41602C8.12147 10.6796 7.88268 10.4408 7.88268 10.1463ZM8.41602 5.34628C8.12147 5.34628 7.88268 5.58507 7.88268 5.87962C7.88268 6.17416 8.12147 6.41295 8.41602 6.41295H12.6827C12.9772 6.41295 13.216 6.17416 13.216 5.87962C13.216 5.58507 12.9772 5.34628 12.6827 5.34628H8.41602Z" fill="#1C2024" />
  </svg>
);

const IncidentStateIcon = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="16" height="16" transform="translate(0.416016 0.512939)" fill="white" fillOpacity="0.01" />
    <path fillRule="evenodd" clipRule="evenodd" d="M1.35156 8.51284C1.35156 4.61131 4.51438 1.44849 8.41592 1.44849C12.3175 1.44849 15.4802 4.61131 15.4802 8.51284C15.4802 12.4143 12.3175 15.5772 8.41592 15.5772C4.51438 15.5772 1.35156 12.4143 1.35156 8.51284ZM8.41592 2.46181C5.07403 2.46181 2.3649 5.17096 2.3649 8.51284C2.3649 11.8547 5.07403 14.5639 8.41592 14.5639C11.7578 14.5639 14.4669 11.8547 14.4669 8.51284C14.4669 5.17096 11.7578 2.46181 8.41592 2.46181Z" fill="#FFE629" />
  </svg>
);

const IconMapper = {
  'Incident ID': <IncidentIdIcon />,
  'Incident State': <IncidentStateIcon />,
  'Incident Type': <AlertTriangle color="#F2C94C" size={16} />,
  'Incident Priority': <AlertOctagon color="#F2994A" size={16} />,
  'Incident Urgency': <AlertOctagon color="#F2994A" size={16} />,
  'Incident Impact': <AlertOctagon color="#F2994A" size={16} />,
  Timestamp: <Clock3 color="#5B5BD6" size={16} />,
};

const OverviewRow = ({ label, value }: { label: string; value: string | React.ReactNode }) => (
  <Flex className="items-center gap-2 h-9">
    <Flex align="center" className="w-[40%]">
      <Text size="2" weight="medium" className="text-[#858699]">
        {label}:
      </Text>
    </Flex>
    <Flex align="center" className="w-[60%] gap-2">
      {IconMapper[label] ?? null}
      <Text size="2" weight="medium" className="text-[#858699]">
        {value || 'NA'}
      </Text>
    </Flex>
  </Flex>
);

const IncidentDetails = ({
  incidentId,
}: {
  incidentId: string;
}) => {
  const [expanded, setExpanded] = useState(true);

  const { incidentDetails } = useIncidentDetails({
    incidentId: incidentId,
  });

  if (!incidentDetails) return null;

  return (
    <Box className="mb-4">
      <Flex align="center" justify="between" className="cursor-pointer" onClick={() => setExpanded((prev) => !prev)}>
        <Text size="3" weight="medium" className="text-dark-100">
          Incident Overview
        </Text>
        {expanded ? <ChevronUp /> : <ChevronDown />}
      </Flex>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Box className="p-3">
              <Flex direction="column" gap="2">
                <OverviewRow
                  label="Incident ID"
                  value={
                    incidentDetails?.sys_id ? (
                      <a
                        href={incidentDetails.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        {incidentDetails.sys_id}
                      </a>
                    ) : 'NA'
                  }
                />
                <OverviewRow label="Incident State" value={incidentDetails?.incident_state ?? 'NA'} />
                <OverviewRow label="Incident Type" value={incidentDetails?.contact_type ?? 'NA'} />
                <OverviewRow label="Incident Priority" value={incidentDetails?.priority ?? 'NA'} />
                <OverviewRow label="Incident Urgency" value={incidentDetails?.urgency ?? 'NA'} />
                <OverviewRow label="Incident Impact" value={incidentDetails?.impact ?? 'NA'} />
                <OverviewRow
                  label="Timestamp"
                  value={
                    incidentDetails?.opened_at
                      ? format(new Date(incidentDetails.opened_at), 'dd MMM yyyy hh:mm a')
                      : 'NA'
                  }
                />
              </Flex>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default IncidentDetails;