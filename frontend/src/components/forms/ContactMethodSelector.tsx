import React from 'react';
import { useTranslation } from 'react-i18next';
import { CONTACT_METHODS } from 'config/constants';
import { Flex, Text } from '@radix-ui/themes';
import RadioButton from './RadioButton';
// import Radio from 'components/radio';

// Define the types for the props
type ContactMethodSelectorProps = {
  contactMethod: string;
  setContactMethod: (method: string) => void;
  isSubmitted: boolean;
  incomingPhoneNumber: string;
  phoneIntegrationEnabled: boolean;
  meetingIntegrationEnabled: boolean;
};

function ContactMethodSelector({
  contactMethod,
  setContactMethod,
  isSubmitted,
  incomingPhoneNumber,
  phoneIntegrationEnabled,
  meetingIntegrationEnabled,
}: ContactMethodSelectorProps) {
  const { t } = useTranslation();
  // A mapping to display human-friendly labels
  const labels: Record<string, string> = {
    phoneNumber: t('voice_copilot.phoneCall'),
    meetingUrl: t('voice_copilot.onlineMeeting'),
  };

  return (
    <Flex gap="4">
      {phoneIntegrationEnabled && (
        <RadioButton
          checked={contactMethod === CONTACT_METHODS.phoneNumber}
          onChange={() => setContactMethod(CONTACT_METHODS.phoneNumber)}
          disabled={isSubmitted}
          value={CONTACT_METHODS.phoneNumber}
          label={labels.phoneNumber}
          name="contact-method"
        />
      )}
      {/* {meetingIntegrationEnabled && (
        <RadioButton
          checked={contactMethod === CONTACT_METHODS.meetingUrl}
          onChange={() => setContactMethod(CONTACT_METHODS.meetingUrl)}
          disabled={isSubmitted}
          value={CONTACT_METHODS.meetingUrl}
          label={labels.meetingUrl}
          name="contact-method"
        />
      )} */}
      {phoneIntegrationEnabled && (
        <Text size="2" className="">
          {t('voice_copilot.mobileNumber')}:
          {' '}
          {' '}
          <span className="font-bold">{incomingPhoneNumber}</span>
        </Text>
      )}
    </Flex>
  );
}

export default ContactMethodSelector;
