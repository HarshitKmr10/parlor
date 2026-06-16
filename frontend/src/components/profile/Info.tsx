import React, { useState, useEffect } from 'react';
import { useGlobalContext } from 'contexts/store';
import {
  Card, Flex, Text, TextField, Button,
} from '@radix-ui/themes';
import { API } from 'api';
import { useTranslation } from 'react-i18next';

function Information({ setLoading }) {
  const { t } = useTranslation();
  const { user, setUser } = useGlobalContext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (user) {
      setName(user?.name || t('profile.yourFullName'));
      setEmail(user?.email || t('profile.yourEmailExample'));
    }
  }, [user, t]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await API.User.UpdateUserPersonal(user?.id, name);
      setUser((prevUser) => ({ ...prevUser, name }));
    } catch (error) {
      console.error(`Error fetching data: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ width: '100%', marginTop: '12px', padding: '24px' }}>
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="1">
          <Text size="5" weight="bold">
            {t('profile.accountSettings')}
          </Text>
          <Text as="p" size="2" color="gray">
            {t('profile.changeUserAccountInformation')}
          </Text>
        </Flex>

        <Flex direction="column" gap="4">
          <TextField.Root
            placeholder={t('profile.yourFullName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="3"
          />
          <TextField.Root
            placeholder={t('profile.yourEmailExample')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled
            size="3"
          />
        </Flex>

        <Flex justify="start">
          <Button onClick={handleSubmit} className="cursor-pointer">{t('profile.saveChanges')}</Button>
        </Flex>
      </Flex>
    </Card>
  );
}

export default Information;
