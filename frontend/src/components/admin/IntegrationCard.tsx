import { CheckCircledIcon } from '@radix-ui/react-icons';
import { Flex, Text } from '@radix-ui/themes';
import Image from 'next/image';

export interface Integration {
  provider:  string; // 'SERVICENOW' | 'AZURE' | 'INTUNE';
  integrationType: string; // 'ITSM' | 'RUNBOOKS'
  name: string;
  description: string;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  inputFields: {
    formConfig?: { name: string; label: string; placeholder: string }[];
    formSecret?: { name: string; label: string; placeholder: string }[];
  }
  testUrl?: string;
  document: React.ReactNode;
}

interface IntegrationCardProps {
  integration: Integration;
  isConnected?: boolean;
  onClick: (integration: Integration) => void;
}

export const IntegrationCard = ({ integration, isConnected, onClick }: IntegrationCardProps) => {
  const { name, description, imageUrl, imageWidth = 64, imageHeight = 64 } = integration;
  return (
    <Flex direction="column" p="4" className="overflow-hidden rounded-lg border cursor-pointer" onClick={(): void => onClick(integration)}>
      <Flex className="mb-2 flex-1" justify="between">
        <Image src={imageUrl} alt="Integration Icon" width={imageWidth} height={imageHeight} />
        {isConnected && <CheckCircledIcon className="text-green-600" height={32} width={32} />}
      </Flex>
      <Text size="4" weight="medium">
        {name}
      </Text>
      <Text size="2">{description}</Text>
    </Flex>
  );
};
