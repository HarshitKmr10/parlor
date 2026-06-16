import React from 'react';
import { useTranslation } from 'react-i18next';
import { CONTACT_METHODS } from 'config/constants';
import { Flex, Text, TextField } from '@radix-ui/themes';

// Types and interfaces for the component props and data structures
interface FormData {
  link?: string;
  title?: string;
  botName?: string;
  phoneNumber?: string;
}

interface ValidationErrors {
  [key: string]: string;
}

interface ContactDetailsProps {
  contactMethod: string;
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  formData: FormData;
  isSubmitted: boolean;
  validationErrors: ValidationErrors;
}

export function PhoneNumber({
  handleChange,
  formData,
  isSubmitted,
  validationErrors,
}: {
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  formData: FormData;
  isSubmitted: boolean;
  validationErrors: ValidationErrors;
}) {
  const { t } = useTranslation();
  return (
    <Flex direction="column" gap="1">
      <Text size="2" weight="medium">{t('voice_copilot.phoneNumber')}</Text>
      <TextField.Root
        className="w-full"
        placeholder="E.g. +91743104XXXX"
        name="phoneNumber"
        disabled={isSubmitted}
        onChange={handleChange}
        value={formData.phoneNumber}
      />

      {/* validation errors */}
      {!!validationErrors.phoneNumber && (
        <Text size="1" className="text-red-400">
          {validationErrors.phoneNumber}
        </Text>
      )}
    </Flex>
  );
}

export function MeetingDetails({
  handleChange,
  formData,
  isSubmitted,
  validationErrors,
}: {
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  formData: FormData;
  isSubmitted: boolean;
  validationErrors: ValidationErrors;
}) {
  const { t } = useTranslation();
  return (
    <Flex direction="column" gap="2">
      {/* meeting url field */}
      <Flex direction="column" gap="1">
        <Text size="2" weight="medium">{t('voice_copilot.meetingUrl')}</Text>
        <TextField.Root
          className="w-full"
          placeholder="E.g. https://meet.google.com/abc-def-ghi"
          disabled={isSubmitted}
          name="link"
          onChange={handleChange}
          type="url"
          value={formData.link}
        />
        {!!validationErrors.link && (
          <Text size="1" className="text-red-400">{validationErrors.link}</Text>
        )}
      </Flex>
      <Flex width="100%" justify="between" gap="3">
        {/* title field */}
        <Flex direction="column" gap="1" width="100%">
          <Text size="2" weight="medium">{t('voice_copilot.title')}</Text>
          <TextField.Root
            className="w-full"
            name="title"
            placeholder="E.g. Drivers Installation"
            disabled={isSubmitted}
            onChange={handleChange}
            value={formData.title}
            maxLength={200}
          />
          {!!validationErrors.title && (
            <Text size="1" className="text-red-400">{validationErrors.title}</Text>
          )}
        </Flex>
        {/* bot name field */}
        <Flex direction="column" gap="1" width="100%">
          <Text size="2" weight="medium">{t('voice_copilot.botName')}</Text>
          <TextField.Root
            className="w-full"
            placeholder="E.g. Pentagrammic Prism Penguin"
            name="botName"
            disabled={isSubmitted}
            onChange={handleChange}
            value={formData.botName}
            maxLength={200}
          />
        </Flex>
      </Flex>
    </Flex>
  );
}

function ContactDetails({
  contactMethod,
  handleChange,
  formData,
  isSubmitted,
  validationErrors,
}: ContactDetailsProps) {
  return (
    <div className="mb-2">
      {contactMethod === CONTACT_METHODS.meetingUrl && (
        <MeetingDetails
          handleChange={handleChange}
          formData={formData}
          isSubmitted={isSubmitted}
          validationErrors={validationErrors}
        />
      )}
      {contactMethod === CONTACT_METHODS.phoneNumber && (
        <PhoneNumber
          handleChange={handleChange}
          formData={formData}
          isSubmitted={isSubmitted}
          validationErrors={validationErrors}
        />
      )}
    </div>
  );
}

export default ContactDetails;
