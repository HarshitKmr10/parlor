import React, { useCallback, useMemo, useState } from 'react';
import { Text, Flex, TextField, Button, TextArea } from '@radix-ui/themes';
import { toast } from 'react-toastify';
import { useGlobalContext } from '@/contexts/store';
import { serviceDeskInstance } from 'api/common/axiosInstance';

interface OrganizationUserFormData {
  fullName: string;
  email: string;
  partner: string;
  comment: string;
}

interface OrganizationUserFormProps {
  orgId: string;
  orgName: string;
  onClose: () => void;
}

const initialFormState: OrganizationUserFormData = {
  fullName: '',
  email: '',
  partner: '',
  comment: '',
};

function OrganizationUserForm({ orgId, orgName, onClose }: OrganizationUserFormProps) {
  

  const [formData, setFormData] = useState<OrganizationUserFormData>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof OrganizationUserFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      toast.error('Full Name is required');
      return false;
    }
    if (!formData.email.trim()) {
      toast.error('Email is required');
      return false;
    }
    if (!formData.partner.trim()) {
      toast.error('Channel Partner is required');
      return false;
    }
    return true;
  };

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!validateForm()) return;

      setIsSubmitting(true);

      try {
        // Call the user-onboarding API endpoint using serviceDeskInstance
        const response = await serviceDeskInstance.post('/user-onboarding', {
          email: formData.email,
          full_name: formData.fullName,
          partner: formData.partner,
          comment: formData.comment,
          org_name: orgName,
        });

        if (response.data.success) {
          toast.success(
            response.data.message || 'User onboarding request submitted successfully! Our team will verify and create the account.',
          );
          setFormData(initialFormState);
          onClose();
        } else {
          toast.error(response.data.message || 'Failed to submit user onboarding request');
        }
      } catch (error: any) {
        console.error('Error submitting user onboarding request:', error);
        const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Failed to submit user onboarding request. Please try again.';
        toast.error(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, onClose],
  );

  return (
    <Flex direction="column" gap="4" p="1">
      <Text size="7" weight="bold">
        Add New Account
      </Text>

      <Text size="2" className="text-blue-800">
        Fill in your details to setup your demo account and link with channel partner.
      </Text>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Text size="2" weight="medium" className="mb-2 block">
            Full Name *
          </Text>
          <TextField.Root
            size="3"
            placeholder="Enter full name"
            value={formData.fullName}
            onChange={(e) => handleInputChange('fullName', e.target.value)}
            required
            className="w-full"
          />
        </div>

        <div>
          <Text size="2" weight="medium" className="mb-2 block">
            Channel Partner *
          </Text>
          <TextField.Root
            size="3"
            placeholder="Eg Company Name"
            value={formData.partner}
            onChange={(e) => handleInputChange('partner', e.target.value)}
            required
            className="w-full"
          />
        </div>

        <div>
          <Text size="2" weight="medium" className="mb-2 block">
            Email Address *
          </Text>
          <TextField.Root
            size="3"
            type="email"
            placeholder="Enter email address"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            required
            className="w-full"
          />
        </div>

        <div>
          <Text size="2" weight="medium" className="mb-2 block">
            Comments (Optional)
          </Text>
          <TextArea
            size="3"
            placeholder="Any additional information..."
            value={formData.comment}
            onChange={(e) => handleInputChange('comment', e.target.value)}
            rows={3}
            className="w-full"
          />
        </div>

        <Flex gap="3" className="pt-2 w-40">
          <Button
            type="button"
            onClick={onClose}
            variant='soft'
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Add User'}
          </Button>
        </Flex>
      </form>
    </Flex>
  );
}

export default OrganizationUserForm;
