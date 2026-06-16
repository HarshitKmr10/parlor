'use client';

import React, { useState } from 'react';
import {
  Flex,
  Box,
  Text,
  Button,
  Checkbox,
  CheckboxGroup,
  DropdownMenu,
  ScrollArea,
} from '@radix-ui/themes';
import TextField from 'components/fields/TextField';
import AISparkleButtonIcon from 'components/icons/AISparkleButtonIcon';
import InputField from 'components/fields/InputField';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import withAuth from 'components/withAuth';

function CreateNewModule() {
  const [courseDescription, setCourseDescription] = useState('');
  const [showSidePanel, setShowSidePanel] = useState(false); // Handle visibility of side panel for both "Advanced Settings" and "Generated Content"
  const [panelContent, setPanelContent] = useState<JSX.Element | null>(null); // Dynamic content for the panel
  const [panelType, setPanelType] = useState('advanced');

  // States for advanced settings inputs
  const [numberOfQuizzes, setNumberOfQuizzes] = useState(2);
  const [numberOfIncidents, setNumberOfIncidents] = useState(1);
  const [numberOfKBArticles, setNumberOfKBArticles] = useState(12);
  const [courseDifficulty, setCourseDifficulty] = useState('Beginner');
  const [dropdownOpen, setDropdownOpen] = useState(false); // For dropdown state

  // Dropdown options for Course Difficulty Level
  const difficultyOptions = ['Beginner', 'Intermediate', 'Advanced'];

  const handleDifficultyChange = (level: string) => {
    setCourseDifficulty(level);
    setDropdownOpen(false); // Close dropdown after selecting an option
  };

  const generateModuleContent = () => {
    // Set the content for the side panel and show it
    setPanelContent(
      <>
        <Text size="6" weight="bold" mb="4">
          Software Configuration Issues
        </Text>
        <Text as="p" mb="4">
          Welcome to the module on solving common software configuration issues!
        </Text>
        <Text as="p" mb="4">
          In this lesson, you will learn how to approach, diagnose, and resolve
          configuration problems encountered by users during software
          installations and updates. Follow the steps below to become more
          proficient in resolving such issues effectively.
        </Text>
        <Text size="5" weight="bold" mb="2">
          1. Start by Identifying the Configuration Problem
        </Text>
        <Text as="p" mb="2">
          When a user reports a configuration issue, the first thing to ask is:
        </Text>
        <Text as="p" mb="2">
          What error messages or symptoms are they experiencing?
        </Text>
        <Text as="p" mb="4">
          This will help you categorize the issue more effectively.
        </Text>
        <Text as="p" mb="2">
          You may also want to check if the user has correctly installed any
          required dependencies for the software.
        </Text>
        <Button
          variant="outline"
          mb="2"
          className="max-w-fit"
          onClick={() => console.log('KB0010789')}
        >
          Required Software Dependencies (KB0010789)
        </Button>
        <Text as="p" mb="2">
          Learn more about
        </Text>
        <Button
          variant="outline"
          mb="4"
          className="max-w-fit"
          onClick={() => console.log('KB0010901')}
        >
          Resolving Permissions Errors (KB0010901)
        </Button>
        <Text size="5" weight="bold" mb="2">
          2. Review System Compatibility
        </Text>
        <Text as="p" mb="2">
          Compatibility issues can often arise if the software version is not
          suitable for the user operating system. Ask them to verify their OS
          version and whether it meets the software requirements.
        </Text>
        <Text as="p" mb="2">
          Confirm if they are running Windows 10/11 or macOS Big Sur/Monterey,
          for example.
        </Text>
        <Button
          variant="outline"
          mb="2"
          className="max-w-fit"
          onClick={() => console.log('KB0011023')}
        >
          Operating System Compatibility for Software Installations (KB0011023)
        </Button>
        <Text as="p" mb="4">
          ITs also helpful to check whether other installed programs are
          conflicting with the software.
        </Text>
        <Button
          variant="outline"
          mb="4"
          className="max-w-fit"
          onClick={() => console.log('KB0011024')}
        >
          Software Conflicts & Solutions
        </Button>

        <Text size="5" weight="bold" mb="2">
          3. Check for Configuration File Errors
        </Text>
        <Text as="p" mb="2">
          Configuration issues are often caused by corrupted or misconfigured
          configuration files. The next step is to ask the user if they have
          recently edited any configuration files or installed third-party
          plugins.
        </Text>
        <Text as="p" mb="2">
          Learn how to fix
        </Text>
        <Button
          variant="outline"
          mb="2"
          className="max-w-fit"
          onClick={() => console.log('KB0010567')}
        >
          Corrupted Configuration Files
        </Button>
        <Text as="p" mb="4">
          In some cases, simply resetting the configuration file to its default
          settings can resolve the issue.
        </Text>
      </>,
    );
    setPanelType('generated');
    setShowSidePanel(true); // Show the side panel with generated content
  };

  return (
    <Flex direction="column" className="h-screen">
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Text size="4" weight="medium">
            Trainer Dashboard
          </Text>
        </Flex>
      </Box>

      <Flex direction="row" className="flex-grow overflow-hidden">
        <Flex
          direction="column"
          className="overflow-hidden bg-gray-100 p-4 flex-grow"
        >
          <Box className="p-4 bg-white rounded-md ">
            <Flex direction="column">
              <Text size="5" weight="bold" mb="1">
                Create New Learning Module Using AI
              </Text>
              <Text size="3" mb="2">
                Generate a custom module with automated content based on your
                available documents and incident data.
              </Text>
            </Flex>
            <TextField
              id="course-description"
              label="What is the course about?"
              placeholder='e.g., "This course will cover server troubleshooting and resolving software conflicts in a service desk environment."'
              value={courseDescription}
              onChange={(e) => setCourseDescription(e.target.value)}
              rows={4}
              maxTextAreaHeight="200px"
              minTextAreaHeight="100px"
              size="2"
            />
            <Flex justify="between">
              <Button
                mb="4"
                mt="4"
                className="cursor-pointer"
                onClick={generateModuleContent} // Show the side panel with generated content
              >
                <AISparkleButtonIcon />
                Generate Module
              </Button>
              <Button
                mb="4"
                mt="4"
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setPanelType('advanced');
                  setShowSidePanel(true);
                  setPanelContent(
                    <>
                      <Text size="4" weight="medium" mb="2">
                        Advanced Settings
                      </Text>
                      <InputField
                        id="number-quizzes"
                        label="Number of Quizzes"
                        placeholder="Enter number of quizzes"
                        type="number"
                        value={numberOfQuizzes}
                        onChange={(e) => setNumberOfQuizzes(e.target.value)}
                        size="2"
                      />
                      <InputField
                        id="number-incidents"
                        label="Number of Virtual Incidents"
                        placeholder="Enter number of virtual incidents"
                        type="number"
                        value={numberOfIncidents}
                        onChange={(e) => setNumberOfIncidents(e.target.value)}
                        size="2"
                      />
                      <InputField
                        id="number-kb-articles"
                        label="Number of KB Articles"
                        placeholder="Enter number of KB articles"
                        type="number"
                        value={numberOfKBArticles}
                        onChange={(e) => setNumberOfKBArticles(e.target.value)}
                        size="2"
                      />
                      <DropdownMenu.Root onOpenChange={setDropdownOpen}>
                        <Text
                          size="2"
                          weight="bold"
                          className="text-[var(--gray-9)] mb-1"
                        >
                          Course Difficulty Level
                        </Text>
                        <DropdownMenu.Trigger className="p-2 rounded-md outline outline-offset-3 outline-[1.5px] outline-[var(--gray-7)]">
                          <Button
                            variant="outline"
                            className="justify-between w-full"
                          >
                            {courseDifficulty}
                            {dropdownOpen ? (
                              <ChevronUpIcon />
                            ) : (
                              <ChevronDownIcon />
                            )}
                          </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content
                          className="w-[var(--radix-dropdown-menu-trigger-width)]"
                          size="2"
                        >
                          {difficultyOptions.map((option) => (
                            <DropdownMenu.Item
                              key={option}
                              onSelect={() => handleDifficultyChange(option)}
                            >
                              {option}
                            </DropdownMenu.Item>
                          ))}
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </>,
                  );
                }}
              >
                Advanced Settings
              </Button>
            </Flex>

            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-ignore */}
            <CheckboxGroup.Root defaultValue={['1']} name="example">
              <Text size="3" weight="medium" mb="2" color="gray">
                Source Selection Checkboxes (Document Types & Data Sources)
              </Text>
              <CheckboxGroup.Item value="1">
                Documents
              </CheckboxGroup.Item>
              <CheckboxGroup.Item value="2">
                Incident Reports
              </CheckboxGroup.Item>
              <CheckboxGroup.Item value="3">
                Transition Meeting Notes
              </CheckboxGroup.Item>
              <CheckboxGroup.Item value="4">
                SME Call Records
              </CheckboxGroup.Item>
              <CheckboxGroup.Item value="5">
                Policy Documents
              </CheckboxGroup.Item>
            </CheckboxGroup.Root>
          </Box>
        </Flex>

        {/* Side Panel */}
        {showSidePanel && (
          <Flex
            direction="column"
            className={`bg-white p-4 border-l border-[var(--gray-8)] overflow-y-auto ${
              panelType === 'advanced' ? 'w-1/4' : 'w-2/3'
            } `}
          >
            {panelContent}

            <Button
              mt="4"
              variant="outline"
              className="cursor-pointer max-w-fit"
              onClick={() => setShowSidePanel(false)}
            >
              Close
            </Button>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}

export default withAuth(CreateNewModule);
