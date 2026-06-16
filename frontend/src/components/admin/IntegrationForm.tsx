import { Flex, Text, TextField, Button } from '@radix-ui/themes';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Integration } from '../admin/IntegrationCard';
import { createOrUpdateIntegrations, OrgIntegration } from 'api/integrations';

export function IntegrationForm({
  integration,
  selectedOrgIntegration,
  onSave,
}: {
  integration: Integration;
  selectedOrgIntegration?: OrgIntegration;
  onSave: (orgIntegration: OrgIntegration) => void;
}) {
  const [formConfig, setFormConfig] = useState<Record<string, any> | undefined>();
  const [formSecret, setFormSecret] = useState<Record<string, any> | undefined>();
  const [testStatus, setTestStatus] = useState<'SUCCESS' | 'FAILURE' | undefined>();
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setLoading] = useState(false);

  const onSetConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormConfig((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSetSecret = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormSecret((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTestConnection = () => {
    setIsTesting(true);
    axios
      .post(integration.testUrl, { config: formConfig, secrets: formSecret })
      .then((response) => {
        if (response.data) {
          setTestStatus('SUCCESS');
        } else {
          setTestStatus('FAILURE');
        }
      })
      .catch(() => {
        setTestStatus('FAILURE');
      })
      .finally(() => {
        setIsTesting(false);
      });
  };

  const handleSave = () => {
    if (integration?.testUrl && testStatus !== 'SUCCESS') {
      alert('Please test the connection before saving');
      return;
    }
    setLoading(true);
    createOrUpdateIntegrations(selectedOrgIntegration?.id ? {
      id: selectedOrgIntegration.id,
      integration_type: integration.integrationType,
      provider: integration.provider,
      config: { ...formConfig },
      secrets: { ...formSecret },
    } : {
      integration_type: integration.integrationType,
      provider: integration.provider,
      config: { ...formConfig },
      secrets: { ...formSecret },
    })
      .then((response) => {
        onSave(response.data.data);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedOrgIntegration?.id && selectedOrgIntegration?.config) {
      setFormConfig(selectedOrgIntegration.config);
    }
  }, [integration, integration]);

  return (
    <Flex className="min-h-0 flex-1 p-6 overflow-y-auto">
      <Flex direction="column" className="flex-1">
        {integration.document}
      </Flex>
      <Flex direction="column" gap="4" className="flex-1 sticky top-0" px="8">
        <Flex direction="column" className="rounded-medium border-1 p-8 max-h-[80vh] overflow-y-auto" gap="4">
          {integration.inputFields?.formConfig?.map((field) => (
            <Flex key={field.name} direction="column" gap="1">
              <Text color="iris">{field.label}</Text>
              <TextField.Root
                placeholder={field.placeholder}
                className="w-full rounded-md"
                name={field.name}
                value={formConfig?.[field.name] ?? ''}
                onChange={onSetConfig}
              />
            </Flex>
          ))}
          {integration.inputFields?.formSecret?.map((field) => (
            <Flex key={field.name} direction="column" gap="1">
              <Text color="iris">{field.label}</Text>
              <TextField.Root
                placeholder={field.placeholder}
                className="w-full rounded-md"
                name={field.name}
                type="password"
                value={formSecret?.[field.name] ?? ''}
                onChange={onSetSecret}
              />
            </Flex>
          ))}

          {!!testStatus && (
            <Text color={testStatus === 'SUCCESS' ? 'green' : 'red'} size="2">
              {testStatus === 'SUCCESS' ? 'Connection successful!!' : 'Connection failed!!'}
            </Text>
          )}
          <Flex direction="row" align="center" justify="center" gap="2" mt="4">
            {!!integration?.testUrl && (
                <Button variant="outline" className="flex-1" onClick={handleTestConnection}>
                {isTesting ? 'Testing....' : 'Test connection'}
                </Button>
            )}
            <Button loading={isLoading} className="flex-1" onClick={handleSave}>
              {selectedOrgIntegration?.id ? 'Update' : 'Save'}
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
}
