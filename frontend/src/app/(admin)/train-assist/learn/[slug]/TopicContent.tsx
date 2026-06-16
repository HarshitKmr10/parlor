import React, { useCallback, useState } from 'react';
import {
  Tabs, Flex, Text, Button,
} from '@radix-ui/themes';
import { BookOpen, FileText, PlayCircle } from 'lucide-react';
import VoiceSimulator from 'components/TrainAssist/VoiceSimulator';

type TopicContentProps = {
  topic: string;
  onQuizClick: (topic: string) => void;
  onSimulationClick: (topic: string) => void;
  onKBClick: (kb: string) => void;
  onMarkdownClick: (kb: string) => void;
};

function SoftwareConfigurationIssuesContent({
  onKBClick,
  onMarkdownClick,
}: {
  onKBClick: (kb: string) => void;
  onMarkdownClick: (kb: string) => void;
}) {
  return (
    <>
      <Text as="p" className="mb-4">
        Welcome to the module on solving common software configuration issues!
      </Text>
      <Text as="p" className="mb-4">
        In this lesson, you will learn how to approach, diagnose, and resolve
        configuration problems encountered by users during software
        installations and updates. Follow the steps below to become more
        proficient in resolving such issues effectively.
      </Text>
      <Text size="5" weight="bold" className="mb-2">
        1. Start by Identifying the Configuration Problem
      </Text>
      <Text as="p" className="mb-4">
        When a user reports a configuration issue, the first thing to ask is:
      </Text>
      <Text as="p" className="mb-4">
        What error messages or symptoms are they experiencing?
      </Text>
      <Text as="p" className="mb-4">
        This will help you categorize the issue more effectively.
      </Text>
      <Text as="p" className="mb-4">
        You may also want to check if the user has correctly installed any
        required dependencies for the software.
      </Text>
      <Flex align="center" className="mb-4">
        <Button
          variant="outline"
          className="mr-2"
          onClick={() => onKBClick('KB0010789')}
        >
          Required Software Dependencies (KB0010789)
        </Button>
        <Button variant="ghost" onClick={() => onMarkdownClick('KB0010789')}>
          <FileText className="h-4 w-4" />
        </Button>
      </Flex>
      <Text as="p" className="mb-4">
        Learn more about
      </Text>
      <Flex align="center" className="mb-4">
        <Button
          variant="outline"
          className="mr-2"
          onClick={() => onKBClick('KB0010901')}
        >
          Resolving Permissions Errors (KB0010901)
        </Button>
        <Button variant="ghost" onClick={() => onMarkdownClick('KB0010901')}>
          <FileText className="h-4 w-4" />
        </Button>
      </Flex>
      <Text size="5" weight="bold" className="mb-2">
        2. Review System Compatibility
      </Text>
      <Text as="p" className="mb-4">
        Compatibility issues can often arise if the software version is not
        suitable for the users operating system. Ask them to verify their OS
        version and whether it meets the software requirements.
      </Text>
      <Text as="p" className="mb-4">
        Confirm if they are running Windows 10/11 or macOS Big Sur/Monterey, for
        example.
      </Text>
      <Text as="p" className="mb-4">
        For a detailed guide, read
      </Text>
      <Flex align="center" className="mb-4">
        <Button
          variant="outline"
          className="mr-2"
          onClick={() => onKBClick('KB0011023')}
        >
          Operating System Compatibility for Software Installations (KB0011023)
        </Button>
        <Button variant="ghost" onClick={() => onMarkdownClick('KB0011023')}>
          <FileText className="h-4 w-4" />
        </Button>
      </Flex>
      <Text as="p" className="mb-4">
        It also helpful to check whether other installed programs are
        conflicting with the software.
      </Text>
      <Text as="p" className="mb-4">
        Review potential
      </Text>
      <Flex align="center" className="mb-4">
        <Button
          variant="outline"
          className="mr-2"
          onClick={() => onKBClick('KB0010234')}
        >
          Software Conflicts & Solutions (KB0010234)
        </Button>
        <Button variant="ghost" onClick={() => onMarkdownClick('KB0010234')}>
          <FileText className="h-4 w-4" />
        </Button>
      </Flex>
      <Text size="5" weight="bold" className="mb-2">
        3. Check for Configuration File Errors
      </Text>
      <Text as="p" className="mb-4">
        Configuration issues are often caused by corrupted or misconfigured
        configuration files.
      </Text>
      <Text as="p" className="mb-4">
        The next step is to ask the user if they have recently edited any
        configuration files or installed third-party plugins.
      </Text>
      <Text as="p" className="mb-4">
        Learn how to fix
      </Text>
      <Flex align="center" className="mb-4">
        <Button
          variant="outline"
          className="mr-2"
          onClick={() => onKBClick('KB0010567')}
        >
          Corrupted Configuration Files (KB0010567)
        </Button>
        <Button variant="ghost" onClick={() => onMarkdownClick('KB0010567')}>
          <FileText className="h-4 w-4" />
        </Button>
      </Flex>
    </>
  );
}

function ApplicationInstallationFailuresContent({
  onKBClick,
  onMarkdownClick,
}: {
  onKBClick: (kb: string) => void;
  onMarkdownClick: (kb: string) => void;
}) {
  return (
    <>
      <Text as="p" className="mb-4">
        Welcome to the module on resolving application installation failures!
      </Text>
      <Text as="p" className="mb-4">
        In this lesson, you will learn how to diagnose and solve common issues
        that occur during software installation processes.
      </Text>
      <Text size="5" weight="bold" className="mb-2">
        1. Verify System Requirements
      </Text>
      <Text as="p" className="mb-4">
        Ensure that the user system meets the minimum requirements for the
        application.
      </Text>
      <Flex align="center" className="mb-4">
        <Button
          variant="outline"
          className="mr-2"
          onClick={() => onKBClick('KB0020001')}
        >
          Checking System Requirements (KB0020001)
        </Button>
        <Button variant="ghost" onClick={() => onMarkdownClick('KB0020001')}>
          <FileText className="h-4 w-4" />
        </Button>
      </Flex>
      {/* Add more content and KB articles as needed */}
    </>
  );
}

function TroubleshootingSoftwareCrashesContent({
  onKBClick,
  onMarkdownClick,
}: {
  onKBClick: (kb: string) => void;
  onMarkdownClick: (kb: string) => void;
}) {
  return (
    <>
      <Text as="p" className="mb-4">
        Welcome to the module on troubleshooting software crashes!
      </Text>
      <Text as="p" className="mb-4">
        This lesson will guide you through the process of identifying the root
        causes of software crashes and implementing effective solutions.
      </Text>
      <Text size="5" weight="bold" className="mb-2">
        1. Collect Crash Reports
      </Text>
      <Text as="p" className="mb-4">
        Learn how to gather and interpret crash reports to diagnose the issue.
      </Text>
      <Flex align="center" className="mb-4">
        <Button
          variant="outline"
          className="mr-2"
          onClick={() => onKBClick('KB0030001')}
        >
          Understanding Crash Reports (KB0030001)
        </Button>
        <Button variant="ghost" onClick={() => onMarkdownClick('KB0030001')}>
          <FileText className="h-4 w-4" />
        </Button>
      </Flex>
      {/* Add more content and KB articles as needed */}
    </>
  );
}
function PatchAndUpdateFailuresContent({
  onKBClick,
  onMarkdownClick,
}: {
  onKBClick: (kb: string) => void;
  onMarkdownClick: (kb: string) => void;
}) {
  return (
    <>
      <Text as="p" className="mb-4">
        Welcome to the module on resolving patch and update failures!
      </Text>
      <Text as="p" className="mb-4">
        This lesson will teach you how to troubleshoot and fix issues that occur
        during software updates and patch installations.
      </Text>
      <Text size="5" weight="bold" className="mb-2">
        1. Identify Update Error Codes
      </Text>
      <Text as="p" className="mb-4">
        Learn how to interpret common error codes associated with update
        failures.
      </Text>
      <Flex align="center" className="mb-4">
        <Button
          variant="outline"
          className="mr-2"
          onClick={() => onKBClick('KB0040001')}
        >
          Common Update Error Codes (KB0040001)
        </Button>
        <Button variant="ghost" onClick={() => onMarkdownClick('KB0040001')}>
          <FileText className="h-4 w-4" />
        </Button>
      </Flex>
      {/* Add more content and KB articles as needed */}
    </>
  );
}

function LicenseActivationAndValidationContent({
  onKBClick,
  onMarkdownClick,
}: {
  onKBClick: (kb: string) => void;
  onMarkdownClick: (kb: string) => void;
}) {
  return (
    <>
      <Text as="p" className="mb-4">
        Welcome to the module on license activation and validation!
      </Text>
      <Text as="p" className="mb-4">
        This lesson will guide you through the process of troubleshooting issues
        related to software licensing and activation.
      </Text>
      <Text size="5" weight="bold" className="mb-2">
        1. Understanding License Types
      </Text>
      <Text as="p" className="mb-4">
        Learn about different types of software licenses and their activation
        methods.
      </Text>
      <Flex align="center" className="mb-4">
        <Button
          variant="outline"
          className="mr-2"
          onClick={() => onKBClick('KB0050001')}
        >
          Software License Types Explained (KB0050001)
        </Button>
        <Button variant="ghost" onClick={() => onMarkdownClick('KB0050001')}>
          <FileText className="h-4 w-4" />
        </Button>
      </Flex>
      {/* Add more content and KB articles as needed */}
    </>
  );
}

function SlowSoftwarePerformanceContent({
  onKBClick,
  onMarkdownClick,
}: {
  onKBClick: (kb: string) => void;
  onMarkdownClick: (kb: string) => void;
}) {
  return (
    <>
      <Text as="p" className="mb-4">
        Welcome to the module on addressing slow software performance!
      </Text>
      <Text as="p" className="mb-4">
        This lesson will teach you how to identify and resolve issues that cause
        software to run slowly or inefficiently.
      </Text>
      <Text size="5" weight="bold" className="mb-2">
        1. Identify Performance Bottlenecks
      </Text>
      <Text as="p" className="mb-4">
        Learn how to use system monitoring tools to identify performance
        bottlenecks.
      </Text>
      <Flex align="center" className="mb-4">
        <Button
          variant="outline"
          className="mr-2"
          onClick={() => onKBClick('KB0060001')}
        >
          Using Performance Monitoring Tools (KB0060001)
        </Button>
        <Button variant="ghost" onClick={() => onMarkdownClick('KB0060001')}>
          <FileText className="h-4 w-4" />
        </Button>
      </Flex>
      {/* Add more content and KB articles as needed */}
    </>
  );
}

function MisconceptionsAboutPerformanceContent({
  onKBClick,
  onMarkdownClick,
}: {
  onKBClick: (kb: string) => void;
  onMarkdownClick: (kb: string) => void;
}) {
  return (
    <>
      <Text as="p" className="mb-4">
        Welcome to the module on addressing misconceptions about software
        performance!
      </Text>
      <Text as="p" className="mb-4">
        This lesson will help you understand and debunk common myths about
        software performance, enabling you to provide more accurate support to
        users.
      </Text>
      <Text size="5" weight="bold" className="mb-2">
        1. Common Performance Myths
      </Text>
      <Text as="p" className="mb-4">
        Learn about widespread misconceptions regarding software performance and
        their realities.
      </Text>
      <Flex align="center" className="mb-4">
        <Button
          variant="outline"
          className="mr-2"
          onClick={() => onKBClick('KB0070001')}
        >
          Debunking Performance Myths (KB0070001)
        </Button>
        <Button variant="ghost" onClick={() => onMarkdownClick('KB0070001')}>
          <FileText className="h-4 w-4" />
        </Button>
      </Flex>
      {/* Add more content and KB articles as needed */}
    </>
  );
}

function TopicContent({
  topic,
  onQuizClick,
  onSimulationClick,
  onKBClick,
  onMarkdownClick,
}: TopicContentProps) {
  const [showVoiceSimulation, setShowVoiceSimulation] = useState<boolean>(false);
  const renderContent = () => {
    switch (topic) {
      case 'Software Configuration Issues':
        return <SoftwareConfigurationIssuesContent onKBClick={onKBClick} onMarkdownClick={onMarkdownClick} />;
      case 'Application Installation Failures':
        return <ApplicationInstallationFailuresContent onKBClick={onKBClick} onMarkdownClick={onMarkdownClick} />;
      case 'Troubleshooting Software Crashes':
        return <TroubleshootingSoftwareCrashesContent onKBClick={onKBClick} onMarkdownClick={onMarkdownClick} />;
      case 'Patch and Update Failures':
        return <PatchAndUpdateFailuresContent onKBClick={onKBClick} onMarkdownClick={onMarkdownClick} />;
      case 'License Activation and Validation':
        return <LicenseActivationAndValidationContent onKBClick={onKBClick} onMarkdownClick={onMarkdownClick} />;
      case 'Slow Software Performance':
        return <SlowSoftwarePerformanceContent onKBClick={onKBClick} onMarkdownClick={onMarkdownClick} />;
      case 'Misconceptions about Performance':
        return <MisconceptionsAboutPerformanceContent onKBClick={onKBClick} onMarkdownClick={onMarkdownClick} />;
      default:
        return null;
    }
  };

  const toggleVoiceSimulator = useCallback(() => {
    setShowVoiceSimulation((prev) => !prev);
  }, []);

  return (
    <Tabs.Content key={topic} value={topic}>
      <Flex justify="between" align="center" className="mb-4 ">
        <Text size="6" weight="bold">
          {topic}
        </Text>
        <Flex gap="2">
          <Button variant="outline" onClick={() => onQuizClick(topic)}>
            <BookOpen className="w-4 h-4" />
            Take a Quiz
          </Button>
          <Button variant="outline" onClick={() => onSimulationClick(topic)}>
            <PlayCircle className="w-4 h-4" />
            Chat Simulation
          </Button>
          <Button
            variant="outline"
            onClick={toggleVoiceSimulator}
            className='cursor-pointer'
          >
            <PlayCircle className="w-4 h-4" />
            Voice Simulation
          </Button>
        </Flex>
      </Flex>
      <Flex className="flex-col overflow-y-auto ">
        {renderContent()}
        {showVoiceSimulation && <VoiceSimulator open={showVoiceSimulation} onClose={toggleVoiceSimulator}/>}
      </Flex>
    </Tabs.Content>
  );
}

export default TopicContent;
