"use client";

import { useAppCreator } from "../AppCreatorProvider";
import { Button, Card, Flex, Heading, Tabs, Text } from "@radix-ui/themes";
import { Copy, Check } from "lucide-react";
import React, { useState } from "react";

export function ReviewStep() {
  const { formData, setCurrentStep } = useAppCreator();
  const [copied, setCopied] = useState(false);

  const handleEdit = (step: string) => {
    setCurrentStep(step as any);
  };

  const configurationJson = {
    integrations: formData.integrations?.map((integration) => integration?.name) ?? [],
    knowledgeSources: formData.knowledgeSources?.map((source) => source.name) ?? [],
    agents: formData.agents?.[0]
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(configurationJson, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-auto pb-20">
        <Tabs.Root defaultValue="summary" className="w-full">
          <Tabs.List className="mb-4">
            <Tabs.Trigger value="summary">Summary</Tabs.Trigger>
            <Tabs.Trigger value="json">JSON Configuration</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="summary" className="space-y-6">
            <Card>
              <Flex direction="column" gap="4">
                <Heading>Basic Information</Heading>
              </Flex>
              <Flex direction="column" gap="4">
                <p>
                  <strong>Name:</strong> {formData.basic.name}
                </p>
                <p>
                  <strong>Description:</strong> {formData.basic.description || "N/A"}
                </p>
                <Button variant="outline" size="2" className="mt-2" onClick={() => handleEdit("basic")}>
                  Edit
                </Button>
              </Flex>
            </Card>

            <Card>
              <Flex direction="column" gap="4">
                <Heading>Integrations</Heading>
              </Flex>
              <Flex direction="column" gap="4">
                <p>
                  <strong>Selected Integrations:</strong> {formData.integrations?.map((integration) => integration?.name).join(", ") || "None"}
                </p>
                <Button variant="outline" size="2" className="mt-2" onClick={() => handleEdit("integrations")}>
                  Edit
                </Button>
              </Flex>
            </Card>

            <Card>
              <Flex direction="column" gap="4">
                <Heading>Knowledge Sources</Heading>
              </Flex>
              <Flex direction="column" gap="4">
                <p>
                  {formData.knowledgeSources?.map((source) => source.name).join(", ") || "None"}
                </p>
                <Button variant="outline" size="2" className="mt-2" onClick={() => handleEdit("knowledge")}>
                  Edit
                </Button>
              </Flex>
            </Card>

            <Card>
              <Flex direction="column" gap="4">
                <Heading>AI Agents</Heading>
              </Flex>
              <Flex direction="column" gap="4">
                {formData.agents.map((agent) => (
                  <React.Fragment key={agent.agentName}>
                    {agent.type === "custom" ? (
                      <Text weight="medium">
                        Custom Agents: {agent.agentName}
                      </Text>
                    ) : (
                      <Text weight="medium">
                        Predefined Agent: {agent.agentName}
                      </Text>
                    )}
                  </React.Fragment>
                ))}
                <Button variant="outline" size="2" className="mt-2" onClick={() => handleEdit("agents")}>
                  Edit
                </Button>
              </Flex>
            </Card>

          </Tabs.Content>

          <Tabs.Content value="json" className="relative">
            <Card>
              <Flex direction="column" gap="4">
                <Heading>JSON Configuration</Heading>
                <Button variant="outline" size="2" onClick={copyToClipboard}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </Flex>
              <Flex direction="column" gap="4">
                <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto max-h-[60vh]">
                  <code>{JSON.stringify(configurationJson, null, 2)}</code>
                </pre>
              </Flex>
            </Card>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}

