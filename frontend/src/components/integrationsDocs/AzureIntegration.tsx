import { Flex, Text } from '@radix-ui/themes';
import React from 'react';

export function AzureIntegration() {
  return (
      <Flex direction="column" className="flex-1">
        <Text weight="bold" mb="2">
          Instructions to integrate Azure Devops
        </Text>
        <Text>Connect your Azure devops account by following these steps:</Text>
        <ol className="mt-1 list-decimal py-2 pl-6 text-coolGrey-600">
          <li>Create a Service Principal</li>
          <li>
            Setup Azure DevOps Integration:
            <ul className="list-inside list-disc">
              <li><strong>Navigate to Azure DevOps Organization:</strong> Log in to your Azure DevOps account and navigate to the organization where you want to grant access.</li>
              <li><strong>Go to Organization Settings:</strong> In the lower left corner, select Organization Settings.</li>
              <li><strong>Add Service Principal to Users:</strong> In the left sidebar, click Users and then select Add Users.</li>
              <li><strong>Grant Access to Projects:</strong> Add the Service Principal to the specific projects you want Hawkeye to access. This ensures Hawkeye can retrieve the necessary telemetry.</li>
            </ul>
          </li>
          <li>
            Enter the required credentials::
            <ul className="list-inside list-disc">
              <li><strong>Tenant ID:</strong> Your Azure tenant ID.</li>
              <li><strong>Client ID:</strong> The client ID from your registered application.</li>
              <li><strong>Client Secret:</strong> The secret you created.</li>
              <li><strong>Organization URL:</strong> The URL of the Azure DevOps organization you integrated with in step 2. The organization URL is typically in the format https://dev.azure.com/your-org-name.</li>
            </ul>
          </li>
          <li>Enter these credentials in the form to validate the integration.</li>
        </ol>
      </Flex>
  );
}
