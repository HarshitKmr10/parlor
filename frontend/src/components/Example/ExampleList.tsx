import { Organization } from "types/common";
import { Box, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import AgentAssistLogo from "components/icons/AgentAssistLogo";
import AgentAssistLogoC8 from "../icons/AgentAssistLogoC8";
import { Example } from "./Example";
import { useTranslation } from 'react-i18next';

const isProfileC8 = process.env.NEXT_PUBLIC_CLIENT === 'PROFILE_C8';

// Default example questions to be displayed when no specific config is found.
export const DEFAULT_EXAMPLES: string[] = [
  "How do I enroll a newly reimaged MacBook into VWGoA ABM",
  "Unable to access a development VM using a private IP configuration",
  "Facing network issue on my iPhone",
  "Issue of not being able to connect to the internet after installing Zscaler",
];

interface Props {
  onExampleClicked: (value: string) => void;
  organization: Organization | null;
}

export function ExampleList({ onExampleClicked, organization }: Props) {
  const { t } = useTranslation();
  let config = null;
  let landingConfig = null;

  if (organization && organization.config) {
    try {
      config = JSON.parse(organization.config);
      landingConfig = config?.Modules?.agent_assist?.landing_page_config;
    } catch (error) {
      console.error(`Failed to parse organization config: ${error}`);
    }
  }

  const headerMessage = landingConfig?.header_message
    ? t('agent_assist.welcomeToAgentAssist', { name: landingConfig.header_message })
    : t('agent_assist.welcomeToAgentAssistDefault');

  const exampleQuestions = landingConfig?.example_questions || DEFAULT_EXAMPLES;
  return (
    <Flex direction="column" align="center" justify="center" mt={{ initial: "2", md: "6" }} mx={{ initial: "4", md: "8" }}>
      <Flex align={{ initial: "start", md: "center" }} direction="column" justify="center" mb="4" mt={{ initial: "8", md: "2" }}>
        <Box className="hidden sm:block">
          {isProfileC8 ? <AgentAssistLogoC8 /> : <AgentAssistLogo />}
        </Box>
        
        <Heading size="6" as="h2" weight="medium" align={{ initial: "left", md: "center" }}>
          {headerMessage}
        </Heading>
        <Text as="p" mt="1" size="1" align={{ initial: "left", md: "center" }}>
          {t('agent_assist.pleaseAskYourQueries')}
        </Text>
      </Flex>
      <Grid columns={{ initial: "1", md: "2" }} gap={{ initial: "4", md: "3" }} mt={{ initial: "2", md: "4" }}>
        {exampleQuestions.map((question) => (
          <Example
            key={question}
            text={question}
            value={question}
            onClick={onExampleClicked}
          />
        ))}
      </Grid>
    </Flex>
  );
}
