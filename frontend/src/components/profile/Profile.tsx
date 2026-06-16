'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MdOutlineLogout, MdOutlineEdit } from 'react-icons/md';
import { useGlobalContext } from 'contexts/store';
import {
  Avatar,
  Button,
  Flex,
  Text,
  Card,
  AlertDialog,
} from '@radix-ui/themes';
import CustomAvatar from '../CustomAvatar';
import { useTranslation } from 'react-i18next';

function Banner({ setLoading }) {
  const { t } = useTranslation();
  const { user, setUser, setSelectedTeam } = useGlobalContext();
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [fileError, setFileError] = useState('');

  const handleChangeProfilePic = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (event) => {
    setLoading(true);
    setFileError('');
    const file = event.target.files[0];
    if (file && ['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      const formData = new FormData();
      formData.append('dp', file, file.name.replace(/\s+/g, '_'));

      const apiEndpoint = `${process.env.NEXT_PUBLIC_FRONTEND_IP}/service_desk/${user?.id}/update_user_dp`;
      try {
        const response = await fetch(apiEndpoint, {
          method: 'PUT',
          body: formData,
          headers: { Authorization: `Bearer ${user?.access_token}` },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(
            `HTTP error! status: ${response.status}, ${errorData.detail}`,
          );
        }

        const result = await response.json();
        setUser({ ...user, profile_pic: result.data[0].profile_pic });
      } catch (error) {
        setFileError(t('profile.failedToUploadImage'));
      } finally {
        setLoading(false);
      }
    } else {
      setFileError(t('profile.pleaseSelectImageFile'));
      setLoading(false);
    }
  };

  const handleLogout = () => {
    router.push('/login');
    setUser(null);
    setSelectedTeam(null);
    localStorage.removeItem('user');
    localStorage.removeItem('selectedTeam');
    localStorage.removeItem('ACCESS_TOKEN');
    localStorage.removeItem('REFRESH_TOKEN');
  };

  return (
    <Card style={{ width: '100%', padding: '16px', overflow: 'hidden' }}>
      <Flex direction="column" gap="3">
        <div
          style={{
            height: '120px',
            background: 'linear-gradient(to right, #8080ff, #4d4dff)',
            borderRadius: '8px',
            position: 'relative',
          }}
        />
        <Flex direction="column" ml="4" className="z-10">
          <CustomAvatar
            alt="image"
            src={user?.profile_pic}
            name={user?.name}
            height="4rem"
            width="4rem"
            extra="border-4 border-white -mt-9"
          />
          <Flex
            width="100%"
            justify="between"
            align="center"
            style={{ marginTop: '16px' }}
          >
            <Flex direction="column" gap="1">
              <Text size="5" weight="bold">
                {user?.name}
              </Text>
              <Text size="2" color="gray">
                {user?.role}
              </Text>
            </Flex>
            <Flex gap="2">
              <Button onClick={handleChangeProfilePic} className="cursor-pointer">
                <Flex align="center" gap="2">
                  <MdOutlineEdit size={18} />
                  <Text>{t('profile.changePic')}</Text>
                </Flex>
              </Button>
              <Button variant="outline" onClick={handleLogout} className="cursor-pointer">
                <Flex align="center" gap="2">
                  <MdOutlineLogout size={18} />
                  <Text>{t('profile.logOut')}</Text>
                </Flex>
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </Flex>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/jpg"
      />

      <AlertDialog.Root
        open={!!fileError}
        onOpenChange={() => setFileError('')}
      >
        <AlertDialog.Content style={{ maxWidth: '450px' }}>
          <AlertDialog.Title>{t('profile.errorUploadingImage')}</AlertDialog.Title>
          <AlertDialog.Description size="2">
            {fileError}
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button color="red">
                {t('profile.close')}
              </Button>
            </AlertDialog.Cancel>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Card>
  );
}

export default Banner;
