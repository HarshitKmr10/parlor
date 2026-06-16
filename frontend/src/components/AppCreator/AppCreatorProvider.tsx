"use client";

import { McpServer } from "api/appsInfra";
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

export type AppCreatorStep = "basic" | "integrations" | "knowledge" | "agents" | "review"

export type AppPredefinedAgent = {
  type: "predefined";
  agentName: string;
};

export type AppCustomAgent = {
  type: "custom";
  agentName: string;
  agentPrompt: string;
};

export type AppAgent = AppPredefinedAgent | AppCustomAgent;

export type Integration = {
  name: string
  description: string
}

export type KnowledgeSource = {
  id: string;
  name: string;
  description: string;
  lastUpdated?: string;
}

export type FormData = {
  basic: { name: string; description: string };
  integrations: Integration[];
  knowledgeSources: KnowledgeSource[];
  agents: (AppAgent)[];  
};

interface AppCreatorContextType {
  currentStep: AppCreatorStep;
  setCurrentStep: (step: AppCreatorStep) => void;
  formData: FormData;
  updateFormData: (updater: ((prevData: FormData) => FormData) | FormData) => void;
  isStepValid: (step: AppCreatorStep) => boolean;
}

const AppCreatorContext = createContext<AppCreatorContextType | undefined>(undefined);

export function AppCreatorProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<AppCreatorStep>("basic");
  const [formData, setFormData] = useState<FormData>({
    basic: { name: "", description: "" },
    integrations: [],
    knowledgeSources: [],
    agents: [],
  });

  console.log(formData);

  const updateFormData = useCallback((updater: ((prevData: Partial<FormData>) => FormData) | FormData) => {
    setFormData((prevData) => {
      if (typeof updater === "function") {
        return updater(prevData);
      } else {
        return { ...prevData, ...updater };
      }
    });
  }, []);

  const isStepValid = useCallback(
    (step: AppCreatorStep): boolean => {
      switch (step) {
        case "basic":
          return !!formData.basic.name;
        case "integrations":
          return formData.integrations?.length > 0;
        case "knowledge":
          return true; // Optional step
        case "agents":
          return formData.agents?.[0]?.type === "predefined" ? !!formData.agents?.[0]?.agentName : !!(formData.agents?.[0]?.agentName && formData.agents?.[0]?.agentPrompt);
        case "review":
          return true;
        default:
          return false;
      }
    },
    [formData],
  );

  const contextValue = useMemo(
    () => ({
      currentStep,
      setCurrentStep,
      formData,
      updateFormData,
      isStepValid,
    }),
    [currentStep, formData, updateFormData, isStepValid],
  );

  return <AppCreatorContext.Provider value={contextValue}>{children}</AppCreatorContext.Provider>;
}

export function useAppCreator() {
  const context = useContext(AppCreatorContext);
  if (!context) throw new Error("useAppCreator must be used within AppCreatorProvider");
  return context;
}

