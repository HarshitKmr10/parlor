"use client";

import { useState, useEffect } from "react";
import { FormData, Integration, useAppCreator } from "../AppCreatorProvider";
import { getMcpServers } from "api/appsInfra";

export function IntegrationsStep() {
  const { formData, updateFormData } = useAppCreator();
  
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>(formData.integrations?.map((integration) => integration?.name) ?? []);

  useEffect(() => {
    const fetchIntegrations = async () => {
      const mcpServers = await getMcpServers();
      // Transform McpServer to Integration type
      const transformedIntegrations: Integration[] = mcpServers.map(server => ({
        name: server.name,
        description: server.capabilities?.join(', ') || 'No capabilities specified'
      }));
      setIntegrations(transformedIntegrations);
    };
    fetchIntegrations();
  }, []);

  const handleServerChange = (serverName: string, checked: boolean) => {
    setSelectedIntegrations((prev) => {
      const updated = checked ? [...prev, serverName] : prev.filter((name) => name !== serverName);
      return updated;
    });
  };

  useEffect(() => {
    if (!integrations?.length) return;
    updateFormData((prevFormData: FormData) => ({
      ...prevFormData,
      integrations: selectedIntegrations?.map((name) => integrations?.find((integration) => integration.name === name)) ?? [],
    }));
  }, [selectedIntegrations, updateFormData]);

  return (
    <div className="space-y-6 flex-1 min-h-0">
      <div>
        <h2 className="text-lg font-semibold mb-2">Select Integrations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {integrations?.map((integration) => (
            <div key={integration.name} className="flex items-center gap-4">
              <input
                type="checkbox"
                id={`integration-${integration.name}`}
                checked={selectedIntegrations.includes(integration.name)}
                onChange={(e) => handleServerChange(integration.name, e.target.checked)}
                className="w-4 h-4"
              />
              <label className="flex flex-col cursor-pointer" htmlFor={`integration-${integration.name}`}>
                <span className="text-gray-700 font-medium text-sm">
                  {integration.name}
                </span>
                <span className="text-gray-500 text-xs">
                  {integration.description}
                </span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

