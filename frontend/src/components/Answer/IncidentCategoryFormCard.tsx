import React, { useState, useCallback, useMemo } from 'react';
import { Flex, Text, Box } from '@radix-ui/themes';
import { SelectorWithSearch } from 'components/fields/SelectorWithSearch';
import InputField from 'components/fields/InputField';

// Preferred contact method options
const CONTACT_METHODS = [
  { value: 'Email', name: 'Email' },
  { value: 'Phone', name: 'Phone' },
  { value: 'MS_Teams', name: 'MS Teams' },
  { value: 'Text', name: 'Text' },
];

// Contact methods that require additional contact information
const CONTACT_METHODS_REQUIRING_INFO = ['Phone', 'Text'];

type IncidentCategoryFormCardProps = {
  categories: string[];
  userEmail?: string;
  onSubmit: (formData: {
    category: string;
    preferred_contact_method: string;
    contact_information?: string;
    user_email?: string;
  }) => Promise<void>;
  isSubmitted?: boolean;
  submittedData?: {
    category: string;
    preferred_contact_method: string;
    contact_information?: string;
  };
};

export const IncidentCategoryFormCard = ({
  categories,
  userEmail,
  onSubmit,
  isSubmitted = false,
  submittedData,
}: IncidentCategoryFormCardProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(submittedData?.category || '');
  const [preferredContactMethod, setPreferredContactMethod] = useState<string>(
    submittedData?.preferred_contact_method || '',
  );
  const [contactInformation, setContactInformation] = useState<string>(
    submittedData?.contact_information || '',
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(isSubmitted);

  // Transform categories to dropdown format
  const categoryOptions = useMemo(() => {
    return categories.map((cat) => ({ value: cat, name: cat }));
  }, [categories]);

  // Check if contact info is required based on selected contact method
  const requiresContactInfo = useMemo(() => {
    return CONTACT_METHODS_REQUIRING_INFO.includes(preferredContactMethod);
  }, [preferredContactMethod]);

  // Validate form
  const isFormValid = useMemo(() => {
    if (!selectedCategory || !preferredContactMethod) return false;
    if (requiresContactInfo && !contactInformation.trim()) return false;
    return true;
  }, [selectedCategory, preferredContactMethod, requiresContactInfo, contactInformation]);

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;

    setIsLoading(true);
    try {
      await onSubmit({
        category: selectedCategory,
        preferred_contact_method: preferredContactMethod,
        ...(requiresContactInfo && contactInformation.trim()
          ? { contact_information: contactInformation.trim() }
          : {}),
        // Include user email for Email or MS_Teams contact methods
        ...(!requiresContactInfo && userEmail ? { user_email: userEmail } : {}),
      });
      // Mark as submitted after successful submission
      setHasSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  }, [
    isFormValid,
    selectedCategory,
    preferredContactMethod,
    requiresContactInfo,
    contactInformation,
    userEmail,
    onSubmit,
  ]);

  // Get placeholder text based on contact method
  const getContactInfoPlaceholder = useCallback(() => {
    switch (preferredContactMethod) {
      case 'Phone':
        return 'Enter your phone number';
      case 'Text':
        return 'Enter your mobile number for text messages';
      default:
        return 'Enter contact information';
    }
  }, [preferredContactMethod]);

  // Get label for contact info field
  const getContactInfoLabel = useCallback(() => {
    switch (preferredContactMethod) {
      case 'Phone':
        return 'Phone Number';
      case 'Text':
        return 'Mobile Number';
      default:
        return 'Contact Information';
    }
  }, [preferredContactMethod]);

  // Render read-only submitted view
  if (hasSubmitted) {
    return (
      <Flex
        direction="column"
        gap="2"
        className="mt-2 w-full max-w-sm rounded-md border border-[var(--accent-6)] bg-[var(--accent-2)] px-3 py-2"
      >
        <Text size="2" weight="bold" style={{ color: 'var(--accent-11)' }}>
          Incident Details Submitted
        </Text>

        <Flex direction="column" gap="1">
          <Flex justify="between" align="center">
            <Text size="1">Issue Category:</Text>
            <Text size="1" weight="medium">{selectedCategory}</Text>
          </Flex>
          <Flex justify="between" align="center">
            <Text size="1">Contact Method:</Text>
            <Text size="1" weight="medium">{preferredContactMethod}</Text>
          </Flex>
          {requiresContactInfo && !!contactInformation && (
            <Flex justify="between" align="center">
              <Text size="1">Contact Number:</Text>
              <Text size="1" weight="medium">{contactInformation}</Text>
            </Flex>
          )}
          {!requiresContactInfo && (
            <Flex justify="between" align="center">
              <Text size="1">Contact Email:</Text>
              <Text size="1" weight="medium">{userEmail || 'ServiceNow Registered Email'}</Text>
            </Flex>
          )}
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      gap="2"
      className="mt-2 w-full max-w-sm rounded-md border border-[var(--gray-6)] px-3 py-2"
    >
      <Text size="2" weight="bold">Incident Details Required</Text>

      <Text size="1">
        Please provide the following information to create your incident ticket.
      </Text>

      <SelectorWithSearch
        label="Issue Category"
        itemValueKey="value"
        itemNameKey="name"
        contentWidth="100%"
        selectedItemValue={selectedCategory}
        onChange={(value) => setSelectedCategory(value)}
        required={true}
        items={categoryOptions}
      />

      <SelectorWithSearch
        label="Preferred Contact Method"
        itemValueKey="value"
        itemNameKey="name"
        contentWidth="100%"
        selectedItemValue={preferredContactMethod}
        onChange={(value) => {
          setPreferredContactMethod(value);
          if (!CONTACT_METHODS_REQUIRING_INFO.includes(value)) {
            setContactInformation('');
          }
        }}
        required={true}
        items={CONTACT_METHODS}
      />

      {!!preferredContactMethod && (
        <Box>
          {requiresContactInfo ? (
            <InputField
              label={getContactInfoLabel()}
              name="contact_information"
              required={true}
              size="2"
              inputClassName="rounded-md"
              type={
                preferredContactMethod === 'Phone' || preferredContactMethod === 'Text'
                  ? 'tel'
                  : 'text'
              }
              value={contactInformation}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactInformation(e.target.value)}
              id="contact_information"
              placeholder={getContactInfoPlaceholder()}
            />
          ) : (
            <Flex
              direction="column"
              gap="1"
              className="rounded-md border border-[var(--accent-6)] bg-[var(--accent-2)] px-2 py-2"
            >
              <Text size="1">
                {userEmail
                  ? 'Your ServiceNow registered email will be used:'
                  : 'Your ServiceNow registered email will be used for communication.'}
              </Text>
              {!!userEmail && (
                <Text size="1" weight="medium">{userEmail}</Text>
              )}
            </Flex>
          )}
        </Box>
      )}

      <button
        className={`mt-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          !isFormValid || isLoading
            ? 'cursor-not-allowed bg-[var(--gray-4)] text-[var(--gray-8)]'
            : 'cursor-pointer bg-[var(--accent-9)] text-white hover:bg-[var(--accent-10)]'
        }`}
        onClick={handleSubmit}
        disabled={!isFormValid || isLoading}
      >
        {isLoading ? 'Submitting...' : 'Continue'}
      </button>
    </Flex>
  );
};
