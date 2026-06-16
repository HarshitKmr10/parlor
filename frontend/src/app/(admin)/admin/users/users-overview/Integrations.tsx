import { Flex, Text, Grid, Heading, Spinner } from '@radix-ui/themes';
import { AzureIntegration } from 'components/integrationsDocs/AzureIntegration';
import { Integration, IntegrationCard } from 'components/admin/IntegrationCard';
import { ServiceNowIntegration } from 'components/integrationsDocs/ServiceNowIntegration';
import { ArrowLeft } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PrometheusIntegration } from 'components/integrationsDocs/PromethousIntegration';
import { getIntegrations, OrgIntegration } from 'api/integrations';
import { IntegrationForm } from 'components/admin/IntegrationForm';
import { toast } from 'react-toastify';
import { useGlobalContext } from 'contexts/store';

export function Integrations() {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | undefined>();
  const [orgIntegrations, setOrgIntegrations] = useState<OrgIntegration[]>();
  const [isLoading, setLoading] = useState(true);

  const { organization } = useGlobalContext();
  const organizationConfig = useMemo(() => {
    try {
      return JSON.parse(organization.config);
    } catch (error) {
      console.error("Error parsing organization config:", error);
    }
  }, [organization]);

  const onIntegrationClicked = useCallback((integration: Integration) => {
    setSelectedIntegration(integration);
  }, []);

  const handleSaveIntegration = useCallback((orgIntegration: OrgIntegration) => {
    // if integration already exists, update it, else add it
    setOrgIntegrations((prevIntegrations) =>
      prevIntegrations.find((it) => it.id === orgIntegration.id)
        ? prevIntegrations.map((item) =>
            item.integration_type === orgIntegration.integration_type
              ? { ...item, ...orgIntegration }
              : item,
          )
        : [...prevIntegrations, orgIntegration],
    );
    setSelectedIntegration(undefined);
  }, []);

  const filteredAvailableIntegrations = useMemo(() => {
    if (!organizationConfig?.ShowIntegrations?.length) return [];
    
    return AVAILABLE_INTEGRATIONS.filter(integration => {
      const integrationKey = `${integration.provider}_${integration.integrationType}`;
      return organizationConfig.ShowIntegrations.includes(integrationKey as any);
    });
  }, [organizationConfig]);

  const connectedIntegrations = useMemo(
    () =>
      filteredAvailableIntegrations.filter((it) =>
        orgIntegrations?.find(
          (orgIt) =>
            orgIt.integration_type === it.integrationType && orgIt.provider === it.provider,
        ),
      ),
    [filteredAvailableIntegrations, orgIntegrations],
  );

  const pendingIntegrations = useMemo(
    () =>
      filteredAvailableIntegrations.filter(
        (it) =>
          !orgIntegrations?.find(
            (orgIt) =>
              orgIt.integration_type === it.integrationType && orgIt.provider === it.provider,
          ),
      ),
    [filteredAvailableIntegrations, orgIntegrations],
  );

  const selectedOrgIntegration = useMemo(() => {
    if (!selectedIntegration) return undefined;
    return orgIntegrations?.find(
      (it) =>
        it.integration_type === selectedIntegration.integrationType &&
        it.provider === selectedIntegration.provider,
    );
  }, [selectedIntegration]);

  useEffect(() => {
    getIntegrations()
      .then((response) => {
        if (response.data?.data) {
          setOrgIntegrations(response.data.data);
        }
      })
      .catch(() => {
        toast.error('Failed to fetch integrations');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <Flex justify="center" align="center" className="h-full w-full p-12">
        <Spinner />
      </Flex>
    );
  }

  return !selectedIntegration ? (
    <Flex direction="column" p="4" gap="6">
      {!!connectedIntegrations.length && (
        <Flex direction="column" gap="2">
          <Flex justify="between" align="center">
            <Text size="4" weight="medium">
              Connected ({connectedIntegrations.length})
            </Text>
          </Flex>
          <Grid columns={{ xs: '2', sm: '3', md: '4', lg: '5', xl: '6' }} gap="4">
            {connectedIntegrations.map((integration) => (
              <IntegrationCard
                key={`${integration.integrationType}-${integration.provider}`}
                isConnected={true}
                integration={integration}
                onClick={onIntegrationClicked}
              />
            ))}
          </Grid>
        </Flex>
      )}

      <Flex direction="column" gap="2">
        <Text size="4" weight="medium">
          Available ({pendingIntegrations.length ?? 0})
        </Text>
        <Grid columns={{ xs: '2', sm: '3', md: '4', lg: '5', xl: '6' }} gap="4">
          {pendingIntegrations.map((integration) => (
            <IntegrationCard
              key={`${integration.integrationType}-${integration.provider}`}
              integration={integration}
              onClick={onIntegrationClicked}
            />
          ))}
        </Grid>
      </Flex>
    </Flex>
  ) : (
    <Flex direction="column" className="fixed inset-14 z-50 -mb-14 -mr-14 overflow-hidden bg-white">
      <Flex gap="4" align="center" p="4">
        <ArrowLeft className="cursor-pointer" onClick={() => setSelectedIntegration(undefined)} />
        <Heading size="4">{selectedIntegration.name}</Heading>
      </Flex>
      <IntegrationForm
        integration={selectedIntegration}
        selectedOrgIntegration={selectedOrgIntegration}
        onSave={(data) =>
          handleSaveIntegration({ ...data, integration_type: selectedIntegration.integrationType })
        }
      />
    </Flex>
  );
}

// create document for each integration type in the src/components/integrationsDocs folder
const AVAILABLE_INTEGRATIONS: Integration[] = [
  {
    provider: 'SERVICENOW',
    integrationType: 'ITSM',
    name: 'Service Now',
    description: 'Connect your Service Now account to manage your resources.',
    document: <ServiceNowIntegration />,
    imageUrl: '/img/integrations/service-now.png',
    imageWidth: 71,
    testUrl: '/api/testServicenow',
    inputFields: {
      formConfig: [
        {
          name: 'instance',
          label: 'ServiceNow Instance',
          placeholder: 'Enter your service now instance (eg. your-instance.service-now.com)',
        },
        {
          name: 'username',
          label: 'Username',
          placeholder: 'Enter your service now username',
        },
      ],
      formSecret: [
        {
          name: 'password',
          label: 'Password',
          placeholder: 'Enter your service now password',
        },
      ],
    },
  },
  {
    provider: 'AZURE',
    integrationType: 'RUNBOOKS',
    name: 'Azure Runbooks',
    description: 'Connect your Azure account to manage your resources.',
    document: <AzureIntegration />,
    imageUrl:
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJkZXZpY29uQXp1cmUwIiB4MT0iNjAuOTE5IiB4Mj0iMTguNjY3IiB5MT0iOS42MDIiIHkyPSIxMzQuNDIzIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agc3RvcC1jb2xvcj0iIzExNGE4YiIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzA2NjliYyIvPjwvbGluZWFyR3JhZGllbnQ+PGxpbmVhckdyYWRpZW50IGlkPSJkZXZpY29uQXp1cmUxIiB4MT0iNzQuMTE3IiB4Mj0iNjQuMzQ0IiB5MT0iNjcuNzcyIiB5Mj0iNzEuMDc2IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agc3RvcC1vcGFjaXR5PSIwLjMiLz48c3RvcCBvZmZzZXQ9Ii4wNzEiIHN0b3Atb3BhY2l0eT0iMC4yIi8+PHN0b3Agb2Zmc2V0PSIuMzIxIiBzdG9wLW9wYWNpdHk9IjAuMSIvPjxzdG9wIG9mZnNldD0iLjYyMyIgc3RvcC1vcGFjaXR5PSIwLjA1Ii8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLW9wYWNpdHk9IjAiLz48L2xpbmVhckdyYWRpZW50PjxsaW5lYXJHcmFkaWVudCBpZD0iZGV2aWNvbkF6dXJlMiIgeDE9IjY4Ljc0MiIgeDI9IjExNS4xMjIiIHkxPSI1Ljk2MSIgeTI9IjEyOS41MjUiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj48c3RvcCBzdG9wLWNvbG9yPSIjM2NjYmY0Ii8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMjg5MmRmIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHBhdGggZmlsbD0idXJsKCNkZXZpY29uQXp1cmUwKSIgZD0iTTQ2LjA5LjAwMmg0MC42ODVMNDQuNTQxIDEyNS4xMzdhNi40ODUgNi40ODUgMCAwIDEtNi4xNDYgNC40MTNINi43MzNhNi40OCA2LjQ4IDAgMCAxLTUuMjYyLTIuNjk5YTYuNDcgNi40NyAwIDAgMS0uODc2LTUuODQ4TDM5Ljk0NCA0LjQxNEE2LjQ5IDYuNDkgMCAwIDEgNDYuMDkgMHoiIHRyYW5zZm9ybT0idHJhbnNsYXRlKC41ODcgNC40Njgpc2NhbGUoLjkxOTA0KSIvPjxwYXRoIGZpbGw9IiMwMDc4ZDQiIGQ9Ik05Ny4yOCA4MS42MDdIMzcuOTg3YTIuNzQzIDIuNzQzIDAgMCAwLTEuODc0IDQuNzUxbDM4LjEgMzUuNTYyYTYgNiAwIDAgMCA0LjA4NyAxLjYxaDMzLjU3NHoiLz48cGF0aCBmaWxsPSJ1cmwoI2Rldmljb25BenVyZTEpIiBkPSJNNDYuMDkuMDAyQTYuNDMgNi40MyAwIDAgMCAzOS45MyA0LjVMLjY0NCAxMjAuODk3YTYuNDcgNi40NyAwIDAgMCA2LjEwNiA4LjY1M2gzMi40OGE2Ljk0IDYuOTQgMCAwIDAgNS4zMjgtNC41MzFsNy44MzQtMjMuMDg5bDI3Ljk4NSAyNi4xMDFhNi42MiA2LjYyIDAgMCAwIDQuMTY1IDEuNTE5aDM2LjM5NmwtMTUuOTYzLTQ1LjYxNmwtNDYuNTMzLjAxMUw4Ni45MjIuMDAyeiIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLjU4NyA0LjQ2OClzY2FsZSguOTE5MDQpIi8+PHBhdGggZmlsbD0idXJsKCNkZXZpY29uQXp1cmUyKSIgZD0iTTk4LjA1NSA0LjQwOEE2LjQ4IDYuNDggMCAwIDAgOTEuOTE3LjAwMkg0Ni41NzVhNi40OCA2LjQ4IDAgMCAxIDYuMTM3IDQuNDA2bDM5LjM1IDExNi41OTRhNi40NzYgNi40NzYgMCAwIDEtNi4xMzcgOC41NWg0NS4zNDRhNi40OCA2LjQ4IDAgMCAwIDYuMTM2LTguNTV6IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSguNTg3IDQuNDY4KXNjYWxlKC45MTkwNCkiLz48L3N2Zz4=',
    inputFields: {
      formConfig: [
        {
          name: 'tenantId',
          label: 'Tenant ID',
          placeholder: 'Enter your azure tenant ID',
        },
        {
          name: 'clientId',
          label: 'Client ID',
          placeholder: 'Enter your azure client ID',
        },
        {
          name: 'organisationUrl',
          label: 'Organisation URL',
          placeholder: 'Enter your azure organisation URL',
        },
      ],
      formSecret: [
        {
          name: 'clientSecret',
          label: 'Client Secret',
          placeholder: 'Enter your azure client secret',
        },
      ],
    },
  },
  {
    provider: 'PROMETHEUS',
    integrationType: 'MONITORING',
    name: 'Prometheus',
    description: 'Connect your Prometheus instance to monitor your resources.',
    document: <PrometheusIntegration />,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Prometheus_software_logo.svg',
    inputFields: {
      formConfig: [
        {
          name: 'prometheusServerUrl',
          label: 'Prometheus Server URL',
          placeholder: 'Enter Prometheus server URL',
        },
      ],
    },
  },
];
