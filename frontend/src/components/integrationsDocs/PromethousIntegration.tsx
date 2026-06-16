import { Flex, Text, Button } from '@radix-ui/themes';
import React from 'react';

export function PrometheusIntegration() {
  return (
    <Flex direction="column" className="flex-1">
      <Text weight="bold" mb="2">
        Instructions to integrate Prometheus
      </Text>
      <Text>
        Configure Prometheus with the provided remote write URL and enter your server URL.
      </Text>
      <ul className="list-decimal space-y-2 pl-6 text-gray-900">
        <li>Copy the provided remote write URL to your Prometheus configuration.</li>
        <li>Add it under the `remote_write` section of your Prometheus YAML configuration file.</li>
        <li>Restart your Prometheus server to apply the changes.</li>
        <li>Enter your Prometheus server URL in the form to validate the integration.</li>
      </ul>
    </Flex>
  );
}
