"use client";

import { useAppCreator, type AppCreatorStep } from "./AppCreatorProvider";
import { BasicInfoStep } from "./steps/basic-info-step";
import { IntegrationsStep } from "./steps/integrations-step";
import { KnowledgeStep } from "./steps/knowledge-step";
import { AgentsStep } from "./steps/agents-step";
import { ReviewStep } from "./steps/review-step";
import { Check, ChevronRight, ArrowLeft } from "lucide-react";
import { useCallback } from "react";
import { Button, Flex, Heading } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { toast } from 'react-toastify';
import { createAgenticApp } from "api/appsInfra";


const steps: { id: AppCreatorStep; title: string }[] = [
  { id: "basic", title: "Basic Info" },
  { id: "integrations", title: "Integrations" },
  { id: "knowledge", title: "Knowledge Sources" },
  { id: "agents", title: "AI Agents" },
  { id: "review", title: "Review" },
];

export function AppCreatorContainer() {
  const { currentStep, setCurrentStep, formData, isStepValid } = useAppCreator();

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  const router = useRouter();

  const goToNext = useCallback(() => {
    if (!isLastStep && isStepValid(currentStep)) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  }, [currentStep, isStepValid, formData, isLastStep, currentStepIndex, setCurrentStep]);

  const goToPrevious = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  }, [isFirstStep, currentStepIndex, setCurrentStep]);

  const handleSubmit = useCallback(async () => {
    try {
      const configurationJson = {
        integrations: formData.integrations?.map((integration) => integration?.name) ?? [],
        knowledgeSources: formData.knowledgeSources?.map((source) => source.id) ?? [],
        agents: formData.agents?.[0]
      };

      await createAgenticApp({
        name: formData.basic.name,
        description: formData.basic.description,
        config: configurationJson,
      });
      toast.success(
        "App created successfully!",
      );
      router.push("/apps");
    } catch (error) {
      console.error("Error submitting application:", error);
    }
  }, [formData]);

  return (
    <Flex direction="column" className="flex-1 min-h-0 h-full overflow-y-scroll">
      {/* Header */}
      <Flex className="bg-white border-b px-4 py-4 sm:px-6 flex items-center flex-row gap-2">
        <ArrowLeft className="h-6 w-8 cursor-pointer" onClick={() => router.back()} />
        <Heading size="4">Create AI Agent Application</Heading>
      </Flex>

      {/* Progress Steps */}
      <Flex className="bg-white border-b overflow-x-auto">
        <div className="container mx-auto px-4 py-4 sm:px-6">
          <nav aria-label="Progress" className="hidden sm:block">
            <ol role="list" className="flex items-center">
              {steps.map((step, index) => (
                <li key={step.id} className={`relative ${index !== steps.length - 1 ? "flex-1" : ""}`}>
                  {index !== steps.length - 1 && (
                    <div className="absolute top-4 left-0 -ml-px mt-0.5 w-full h-0.5 bg-gray-200" aria-hidden="true" />
                  )}
                  <div className="group flex items-start">
                    <span className="flex items-center">
                      <span
                        className={`relative z-10 w-8 h-8 flex items-center justify-center rounded-full ${
                          currentStepIndex >= index ? "bg-[#6C5DD3] text-white" : "bg-white border-2 border-gray-300"
                        }`}
                      >
                        {currentStepIndex > index ? (
                          <Check className="w-5 h-5" aria-hidden="true" />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </span>
                    </span>
                    <span className="ml-4 min-w-0 flex flex-col">
                      <span className="text-xs sm:text-sm font-medium text-gray-900">{step.title}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </nav>
          <div className="sm:hidden text-sm font-medium text-gray-500">
            Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex].title}
          </div>
        </div>
      </Flex>

      {/* Step Content */}

      <Flex direction="column" className="container mx-auto max-w-3xl flex-1 p-4 overflow-y-auto min-h-0">
        {currentStep === "basic" && <BasicInfoStep />}
        {currentStep === "integrations" && <IntegrationsStep />}
        {currentStep === "knowledge" && <KnowledgeStep />}
        {currentStep === "agents" && <AgentsStep />}
        {currentStep === "review" && <ReviewStep />}
      </Flex>

      {/* Navigation */}
      <Flex className="bg-white border-t px-4 py-4 sm:px-6 fixed bottom-0 right-0 left-0">
        <div className="container mx-auto flex justify-between items-center">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={isFirstStep}
            className="flex items-center text-sm sm:text-base"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={isLastStep ? handleSubmit : goToNext}
            disabled={!isStepValid(currentStep)}
            className="bg-[#6C5DD3] hover:bg-[#5648B3] text-white text-sm sm:text-base"
          >
            {isLastStep ? (
              "Create Application"
            ) : (
              <>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </Flex>
    </Flex>
  );
}

