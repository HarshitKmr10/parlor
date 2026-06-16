import { Flex, Text } from '@radix-ui/themes';
import React from 'react';

export function ServiceNowIntegration() {
  return (
    <Flex direction="column" className="flex-1">
      <Text weight="bold" mb="2">
        Instructions to integrate ServiceNow
      </Text>
      <Text>Connect your ServiceNow account by following these steps:</Text>
      <ol className="mt-1 list-decimal py-2 pl-6 text-coolGrey-600">
        <li>Log in to your ServiceNow instance.</li>
        <li>
          Create a dedicated service account:
          <ul className="list-inside list-disc">
            <li>Navigate to "User Administration"</li>
            <li>Create a new user with appropriate roles (incident_manager, read).</li>
            <li>Save the username and password securely.</li>
          </ul>
        </li>
        <li>
          Gather the required information:
          <ul className="list-inside list-disc">
            <li>Instance URL (e.g., company.service-now.com)</li>
            <li>Service account username</li>
            <li>Service account password</li>
          </ul>
        </li>
        <li>Enter these credentials in the form to validate the integration.</li>
      </ol>
    </Flex>
  );
}
