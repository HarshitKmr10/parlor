import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import useFormData from 'hooks/useFormData';
import { CONTACT_METHODS, FORM_FIELDS } from 'config/constants';
import useSubmitForm from 'hooks/useSubmitForm';
import { useGlobalContext } from 'contexts/store';
import Spinner from 'components/spinner/spinner';
import { Button, Flex, Text } from '@radix-ui/themes';
import ContactDetails from './ContactDetails';
import ContactMethodSelector from './ContactMethodSelector';

// Interfaces for TypeScript
interface ValidationErrors {
  [key: string]: string;
}

function JoinForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const { organization } = useGlobalContext();
  const [loadingOrg, setLoadingOrg] = useState<boolean>(true);
  const [phoneIntegrationEnabled, setPhoneIntegrationEnabled] = useState<
  boolean
  >(false);
  const [meetingIntegrationEnabled, setMeetingIntegrationEnabled] = useState<
  boolean
  >(false);
  const [contactMethod, setContactMethod] = useState<string>('');

  useEffect(() => {
    if (!organization?.config) {
      setLoadingOrg(false);
      return;
    }

    try {
      const config = JSON.parse(organization.config);
      const voiceCopilot = config.Modules.voice_copilot?.features;

      const phoneIntegration = voiceCopilot?.phoneIntegration?.enabled || false;
      const meetingIntegration = voiceCopilot?.onlineIntegration?.enabled || false;

      setPhoneIntegrationEnabled(phoneIntegration);
      setMeetingIntegrationEnabled(meetingIntegration);

      if (phoneIntegration) {
        setContactMethod(CONTACT_METHODS.phoneNumber);
      } else if (meetingIntegration) {
        setContactMethod(CONTACT_METHODS.meetingUrl);
      }

      setLoadingOrg(false);
    } catch (e) {
      console.error('Error parsing organization config:', e);
      setLoadingOrg(false);
    }
  }, [organization]);

  const [formData, handleChange, validateFormData] = useFormData(
    FORM_FIELDS,
    contactMethod,
  );

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );
  const { error: submitError, handleSubmit, loading } = useSubmitForm(router);

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors = validateFormData(formData);
    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      handleSubmit(e, formData, contactMethod);
    }
  };

  if (loadingOrg) {
    return <Spinner />;
  }

  const getButtonText = () => {
    if (loading) {
      return contactMethod === CONTACT_METHODS.phoneNumber
        ? t('voice_copilot.dialing')
        : t('voice_copilot.joining');
    }
    return contactMethod === CONTACT_METHODS.phoneNumber ? t('voice_copilot.dial') : t('voice_copilot.join');
  };

  return (
    // <Card extra="m-4 p-4">
    <form onSubmit={handleFormSubmit}>
      <Flex direction="column" gap="3">
        <Text size="3" weight="bold">
          {t('voice_copilot.contactUser')}
        </Text>
        <ContactMethodSelector
          contactMethod={contactMethod}
          setContactMethod={setContactMethod}
          isSubmitted={loading}
          phoneIntegrationEnabled={phoneIntegrationEnabled}
          meetingIntegrationEnabled={meetingIntegrationEnabled}
          incomingPhoneNumber={organization?.phone || t('voice_copilot.loadingPhoneNumber')}
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

export default JoinForm;
