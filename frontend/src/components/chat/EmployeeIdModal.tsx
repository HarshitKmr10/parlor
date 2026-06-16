'use client';

import React, { useState } from 'react';
import { Flex, Text, Button, Box, TextField } from '@radix-ui/themes';
import { X, User, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EmployeeIdModalProps {
  isOpen: boolean;
  actionName: string;
  actionDescription: string;
  onSubmit: (employeeId: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function EmployeeIdModal({
  isOpen,
  actionName,
  actionDescription,
  onSubmit,
  onCancel,
  isLoading = false,
}: EmployeeIdModalProps) {
  const { t } = useTranslation();
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!employeeId.trim()) {
      setError(t('agent_assist.pleaseEnterEmployeeID'));
      return;
    }
    setError(null);
    onSubmit(employeeId.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <Box className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Box className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <Flex justify="between" align="center" className="mb-4">
          <Flex align="center" gap="2">
            <Zap className="h-5 w-5 text-amber-600" />
            <Text size="4" weight="bold" className="text-gray-800">
              {t('agent_assist.executeAction')}
            </Text>
          </Flex>
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
            className="cursor-pointer p-1"
          >
            <X className="h-5 w-5 text-gray-500" />
          </Button>
        </Flex>

        {/* Action Info */}
        <Box className="mb-4 rounded-md border border-amber-100 bg-amber-50 p-3">
          <Text size="2" weight="medium" className="text-amber-800">
            {actionName}
          </Text>
          <Text size="1" className="mt-1 text-amber-700">
            {actionDescription}
          </Text>
        </Box>

        {/* Employee ID Input */}
        <Box className="mb-4">
          <Flex align="center" gap="2" className="mb-2">
            <User className="h-4 w-4 text-gray-500" />
            <Text size="2" weight="medium" className="text-gray-700">
              {t('agent_assist.employeeID')}
            </Text>
          </Flex>
          <TextField.Root
            placeholder={t('agent_assist.enterEmployeeID')}
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="w-full"
          />
          {!!error && (
            <Text size="1" className="mt-1 text-red-600">
              {error}
            </Text>
          )}
          <Text size="1" className="mt-2 text-gray-500">
            {t('agent_assist.enterEmployeeIDToLookup')}
          </Text>
        </Box>

        {/* Actions */}
        <Flex gap="3" justify="end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="cursor-pointer"
          >
            {t('agent_assist.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !employeeId.trim()}
            className="cursor-pointer bg-amber-600 text-white hover:bg-amber-700"
          >
            {isLoading ? t('agent_assist.lookingUpDevice') : t('agent_assist.continue')}
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}

export default EmployeeIdModal;

