"use client";

import { useState, useEffect } from "react";
import { AppCustomAgent, AppPredefinedAgent, FormData, useAppCreator } from "../AppCreatorProvider";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import InputField from "components/fields/InputField";
import { AIAgent } from "api/agents/models";
import { getAIAgents } from "api/agents/api";
import TextField from "components/fields/TextField";

export function AgentsStep() {
  const { formData, updateFormData } = useAppCreator();
  const [aiAgents, setAIAgents] = useState<AIAgent[]>([]);
  
  const [selectedAgent, setSelectedAgent] = useState<(AppCustomAgent | AppPredefinedAgent)>(formData.agents?.[0]);
  const [customAgentName, setCustomAgentName] = useState("");
  const [customAgentPrompt, setCustomAgentPrompt] = useState("");

  useEffect(() => {
    const fetchAIAgents = async () => {
      const agents = await getAIAgents();
      setAIAgents(agents);
    };
    fetchAIAgents();
  }, []);

  const handleCustomAgentSubmit = () => {
    if (customAgentName && customAgentPrompt) {
      updateFormData((prevFormData: FormData) => ({
        ...prevFormData,
        agents: [{ type: "custom", agentName: customAgentName, agentPrompt: customAgentPrompt }],
      }));
      setSelectedAgent({ type: "custom", agentName: customAgentName, agentPrompt: customAgentPrompt });
    }
  };

  const handleAgentSelection = (agentName: string) => {
    updateFormData((prevFormData: FormData) => ({
      ...prevFormData,
      agents: [{ type: "predefined", agentName }],
    }));
    setSelectedAgent({ type: "predefined", agentName });
    setCustomAgentName("");
    setCustomAgentPrompt("");
  };

  const editCustomAgent = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setCustomAgentName((selectedAgent as AppCustomAgent)?.agentName ?? "");
    setCustomAgentPrompt((selectedAgent as AppCustomAgent)?.agentPrompt ?? "");
    setSelectedAgent(undefined);
    if (selectedAgent?.type === 'custom') {
      updateFormData((prevFormData: FormData) => ({
        ...prevFormData,
        agents: [],
      }));
    }
  };

  const selectCustomAgent = () => {
    updateFormData((prevFormData: FormData) => ({
      ...prevFormData,
      agents: [{ type: "custom", agentName: customAgentName, agentPrompt: customAgentPrompt }],
    }));
    setSelectedAgent({ type: "custom", agentName: customAgentName, agentPrompt: customAgentPrompt });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Select AI Agent</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aiAgents.map((agent) => (
            <Card
              key={agent.type}
              className={`cursor-pointer overflow-hidden rounded-md p-4 ${selectedAgent?.type === 'predefined' && selectedAgent?.agentName === agent.type ? "border-1.5 border-[#6C5DD3]" : "border-1"}`}
              onClick={() => handleAgentSelection(agent.type)}
            >
              <Flex direction="column" gap="2">
                <Heading size="3">{agent.name}</Heading>
                <Text color="gray">{agent.type}</Text>
              </Flex>
              <Text>{agent?.description}</Text>
            </Card>
          ))}
          {selectedAgent?.type === 'custom' && (
            <Card className={`cursor-pointer overflow-hidden rounded-md p-4 ${selectedAgent?.type === 'custom' && selectedAgent?.agentName === customAgentName ? "border-1.5 border-[#6C5DD3]" : "border-1"}`} onClick={selectCustomAgent}>
              <Flex direction="column" gap="2">
                <Heading size="3">{customAgentName}</Heading>
                <Text>Prompt: {customAgentPrompt}</Text>
                <Button variant="outline" onClick={editCustomAgent}>Edit</Button>
              </Flex>
            </Card>
          )}
        </div>
      </div>

      {selectedAgent?.type !== 'custom' && (
        <div>
            <h3 className="text-lg font-semibold mb-4">Create Custom Agent</h3>
            <div className="space-y-4">
              <InputField
                id="custom-agent-name"
                label="Custom Agent Name"
                placeholder="Custom Agent Name"
                value={customAgentName}
                onChange={(e) => setCustomAgentName(e.target.value)}
              />
              <TextField
                id="custom-agent-prompt"
                label="Custom Agent Prompt"
                placeholder="Enter custom agent prompt or instructions"
                value={customAgentPrompt}
                onChange={(e) => setCustomAgentPrompt(e.target.value)}
                rows={4}
              />
              <Button onClick={handleCustomAgentSubmit} disabled={!customAgentName || !customAgentPrompt}>
                Add Custom Agent
              </Button>
            </div>
        </div>
      )}
    </div>
  );
}

