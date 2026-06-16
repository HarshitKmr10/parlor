import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import useFormData from 'hooks/useFormData';
import { CONTACT_METHODS, FORM_FIELDS } from 'config/constants';
import { useGlobalContext } from 'contexts/store';
import Spinner from 'components/spinner/spinner';
import { Button, Flex, Text, IconButton } from '@radix-ui/themes';
import useSubmitFormKnowledgeTransition from 'hooks/useSubmitFormKnowledgeTransition';
import ContactDetails from './ContactDetails';
import ContactMethodSelector from './ContactMethodSelector';
import { Cross2Icon } from '@radix-ui/react-icons';

// Interfaces for TypeScript
interface ValidationErrors {
  [key: string]: string;
}

// Add onClose to the component props
interface JoinFormKnowledgeTransitionProps {
  onClose: () => void;
}

const FORM_FIELDS_KNOWLEDGE_TRANSITION = {
  ...FORM_FIELDS,
  botName: 'FuturePath Meeting Bot', // This will be updated in the component
};

function JoinFormKnowledgeTransition({ onClose }: JoinFormKnowledgeTransitionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { organization } = useGlobalContext();
  const [loadingOrg, setLoadingOrg] = useState<boolean>(true);
  const [meetingIntegrationEnabled, setMeetingIntegrationEnabled] =
    useState<boolean>(false);
  const [contactMethod, setContactMethod] = useState<string>('');

  useEffect(() => {
    if (!organization?.config) {
      setLoadingOrg(false);
      return;
    }

    try {
      const config = JSON.parse(organization.config);
      const knowledgeCopilot = config.Modules.knowledge_assist?.features;

      const meetingIntegration =
        knowledgeCopilot?.onlineIntegration?.enabled || false;

      setMeetingIntegrationEnabled(meetingIntegration);

      if (meetingIntegration) {
        setContactMethod(CONTACT_METHODS.meetingUrl);
      }

      setLoadingOrg(false);
    } catch (e) {
      console.error('Error parsing organization config:', e);
      setLoadingOrg(false);
    }
  }, [organization]);

  const formFieldsWithTranslation = {
    ...FORM_FIELDS_KNOWLEDGE_TRANSITION,
    botName: t('knowledge_assist.meetingBotName'),
  };

  const [formData, handleChange, validateFormData] = useFormData(
    formFieldsWithTranslation,
    contactMethod,
  );

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );
  const {
    error: submitError,
    handleSubmit,
    loading,
  } = useSubmitFormKnowledgeTransition(router);

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors = validateFormData(formData);
    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      handleSubmit(e, formData, contactMethod);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  if (loadingOrg) {
    return <Spinner />;
  }

  const getButtonText = () => {
    if (loading) {
      return t('knowledge_assist.joining');
    }
    return t('knowledge_assist.join');
  };

  return (
    // <Card extra="m-4 p-4">
    <form onSubmit={handleFormSubmit}>
      <Flex direction="column" gap="3">
        <Flex justify="between" align="center">
          <Text size="3" weight="bold">
            {t('knowledge_assist.meetingInfo')}
          </Text>
          <IconButton 
            variant="ghost" 
            color="gray" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClose();
            }}
            type="button"
          >
            <Cross2Icon />
          </IconButton>
        </Flex>
        <ContactMethodSelector
          contactMethod={contactMethod}
          setContactMethod={setContactMethod}
          isSubmitted={loading}
          phoneIntegrationEnabled={false}
          meetingIntegrationEnabled={meetingIntegrationEnabled}
          incomingPhoneNumber={organization?.phone || t('knowledge_assist.loadingPhoneNumber')}
        />
        <ContactDetails
          contactMethod={contactMethod}
          handleChange={handleChange}
          formData={formData}
          isSubmitted={loading}
          validationErrors={validationErrors}
        />
        <Button
          disabled={loading}
          loading={loading}
          type="submit"
          // className='w-fit'
        >
          {getButtonText()}
        </Button>
        {!!submitError && <Text className="text-red-400">{submitError}</Text>}
      </Flex>
    </form>
    // </Card>
  );
}

export default JoinFormKnowledgeTransition;
