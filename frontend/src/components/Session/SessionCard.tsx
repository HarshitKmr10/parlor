import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AiOutlineCodeSandbox } from 'react-icons/ai';
import { useParams } from 'next/navigation';
import { Flex, Text } from '@radix-ui/themes';
import { Incident, Session } from 'api/sessions/models';
import { useGlobalContext } from 'contexts/store';

interface SessionCardProps {
  session: Session;
  onSelect: (incidentId: string) => void
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onSelect,
}) => {
  const { incidentId } = useParams();


  const getTypeIcon = () => {
    switch (session.sessionType) {
      case 'incident':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
        case 'alert':
          return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'change':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'adhoc':
        return <AiOutlineCodeSandbox className='h-5 w-5 text-gray-600' />;  
      default:
        return null;
    }
  };

  return (
    <Flex
      align="center"
      className={`p-2.5 cursor-pointer rounded-md group ${incidentId === session.id ? 'bg-iris-4' : 'hover:bg-gray-100'}`}
      onClick={() => onSelect(session.id)}
    >
      <Flex className="mr-3">{getTypeIcon()}</Flex>
      <Flex direction="column" className="flex-1 min-w-0">
        <Text weight="medium" className="truncate">{session.name}</Text>
        <Text className="truncate" color="gray">
          {session.sessionType}
        </Text>
      </Flex>
    </Flex>
  );
};

