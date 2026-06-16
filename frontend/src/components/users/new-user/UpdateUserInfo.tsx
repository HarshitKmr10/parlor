import React, { useState, useEffect } from 'react';
import { Text, Flex, Button } from '@radix-ui/themes';
import { useGlobalContext } from 'contexts/store';
import InputField from 'components/fields/InputField';
import { API } from 'api';
import { serviceDeskInstance } from 'api/common/axiosInstance';

interface UpdateUserInfoProps {
  setIsLoading: (loading: boolean) => void;
  selectedUser: User;
  onUpdateComplete: () => void;
}

interface User {
  name: string[];
  email: string;
  date: string;
  teams: string[];
  platform: {
    id: string;
    profile_type: string;
    profile_username: string;
  }[];
  id: string;
}

function UpdateUserInfo({
  setIsLoading,
  selectedUser,
  onUpdateComplete,
}: UpdateUserInfoProps) {
  const [amazonConnectProfile, setAmazonConnectProfile] = useState('');
  const [serviceNowProfile, setServiceNowProfile] = useState('');
  const { user } = useGlobalContext();

  useEffect(() => {
    if (selectedUser) {
      const amazonConnect = selectedUser.platform.find(
        (p) => p.profile_type === 'Amazon Connect',
      );
      const serviceNow = selectedUser.platform.find(
        (p) => p.profile_type === 'ServiceNow',
      );

      setAmazonConnectProfile(amazonConnect?.profile_username || '');
      setServiceNowProfile(serviceNow?.profile_username || '');
    }
  }, [selectedUser]);

  const updateProfile = async (profileId: string, profileUsername: string) => {
    try {
      const response = await serviceDeskInstance.put(`/service_desk/update_user_profile`, {
        profile_id: profileId,
        profile_username: profileUsername,
      });

      if (response.status !== 200) {
        const errorData = response.data;
        throw new Error(errorData.detail || 'Network response was not ok');
      }
      return response.data.updated_profile;
    } catch (error) {
      console.error('There was a problem updating the profile:', error);
      throw error;
    }
  };

  const createProfile = async (
    profileType: string,
    profileUsername: string,
  ) => {
    try {
      const response = await API.User.InsertUserProfile(
        selectedUser.id,
        profileType,
        profileUsername,
      );
      return response;
    } catch (error) {
      console.error('There was a problem creating the profile:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    const updateOrCreateProfile = async (
      profileType: string,
      profileUsername: string,
    ) => {
      const existingProfile = selectedUser.platform.find(
        (p) => p.profile_type === profileType,
      );

      if (existingProfile) {
        // Always update existing profiles, even with empty strings
        return updateProfile(existingProfile.id, profileUsername);
      } if (profileUsername) {
        // Only create new profiles if there's a non-empty value
        return createProfile(profileType, profileUsername);
      }
      // If the profile doesn't exist and the username is empty, do nothing
      return null;
    };

    try {
      const updatePromises = [];

      if (
        amazonConnectProfile !== ''
        || selectedUser.platform.some((p) => p.profile_type === 'Amazon Connect')
      ) {
        updatePromises.push(
          updateOrCreateProfile('Amazon Connect', amazonConnectProfile),
        );
      }

      if (
        serviceNowProfile !== ''
        || selectedUser.platform.some((p) => p.profile_type === 'ServiceNow')
      ) {
        updatePromises.push(
          updateOrCreateProfile('ServiceNow', serviceNowProfile),
        );
      }

      await Promise.all(updatePromises);

      onUpdateComplete();
    } catch (error) {
      console.error('Error updating/creating profiles:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex direction="column" gap="2" p="2">
      <Text size="5" weight="bold">
        Update User Details
      </Text>
      <Text as="p" size="2" color="gray">
        Update user profile information
      </Text>
      <InputField
        id="name"
        label="Full Name"
        placeholder="Full Name"
        value={selectedUser.name[0] || ''}
        disabled
      />
      <InputField
        id="email"
        label="Email Address"
        placeholder="Email Address"
        type="email"
        value={selectedUser.email}
        disabled
      />
      <InputField
        id="amazonConnectProfile"
        label="Amazon Connect Profile"
        placeholder="Amazon Connect Profile"
        value={amazonConnectProfile}
        onChange={(e) => setAmazonConnectProfile(e.target.value)}
      />
      <InputField
        id="serviceNowProfile"
        label="ServiceNow Profile"
        placeholder="ServiceNow Profile"
        value={serviceNowProfile}
        onChange={(e) => setServiceNowProfile(e.target.value)}
      />
      <Button onClick={handleSubmit} style={{ width: '100%' }} size="3" mt="4">
        Update User Details
      </Button>
    </Flex>
  );
}

export default UpdateUserInfo;
