'use client';

import React, { useEffect, useState } from 'react';
import { Flex, Text, Button, Box } from '@radix-ui/themes';
import { 
  Monitor, 
  User, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface DeviceInfo {
  device_name: string;
  device_id: string;
  os_type: string;
  user_name: string;
}

export interface ActionPrepareResult {
  success: boolean;
  action_id: string;
  action_name: string;
  action_description: string;
  requires_confirmation: boolean;
  device: DeviceInfo | null;
  error?: string;
}

export interface ActionExecuteResult {
  success: boolean;
  request_id: string | null;
  status: string;
  message: string;
  estimated_time_seconds: number;
  details?: Record<string, any>;
}

interface ActionConfirmationProps {
  prepareResult: ActionPrepareResult | null;
  executeResult: ActionExecuteResult | null;
  isLoading: boolean;
  isPreparing: boolean;
  isExecuting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  error?: string;
}

export function ActionConfirmation({
  prepareResult,
  executeResult,
  isLoading,
  isPreparing,
  isExecuting,
  onConfirm,
  onCancel,
  error,
}: ActionConfirmationProps) {
  const { t } = useTranslation();
  const [elapsedTime, setElapsedTime] = useState(0);
  const estimatedTime = executeResult?.estimated_time_seconds || 120;

  // Timer for execution progress
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isExecuting) {
      setElapsedTime(0);
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isExecuting]);

  // Error state
  if (error || prepareResult?.error) {
    return (
      <Box className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <XCircle className="h-5 w-5 text-red-600" />
            <Text size="3" weight="medium" className="text-red-800">
              {t('agent_assist.actionFailed')}
            </Text>
          </Flex>
          <Text size="2" className="text-red-700">
            {error || prepareResult?.error}
          </Text>
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="w-fit cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('agent_assist.returnToChat')}
          </Button>
        </Flex>
      </Box>
    );
  }

  // Preparing state
  if (isPreparing) {
    return (
      <Box className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Flex align="center" gap="3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <Text size="2" className="text-blue-800">
            {t('agent_assist.preparingAction')}
          </Text>
        </Flex>
      </Box>
    );
  }

  // Executing state with progress
  if (isExecuting) {
    const progressPercent = Math.min((elapsedTime / estimatedTime) * 100, 95);
    
    return (
      <Box className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            <Text size="3" weight="medium" className="text-blue-800">
              {t('agent_assist.executing')} {prepareResult?.action_name}
            </Text>
          </Flex>
          
          {/* Progress bar */}
          <Box className="h-2 w-full overflow-hidden rounded-full bg-blue-200">
            <Box 
              className="h-full bg-blue-600 transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </Box>
          
          <Flex justify="between" align="center">
            <Text size="1" className="text-blue-700">
              {t('agent_assist.estimatedTime')} ~{estimatedTime}s
            </Text>
            <Text size="1" className="text-blue-700">
              {t('agent_assist.elapsed')} {elapsedTime}s
            </Text>
          </Flex>
          
          {Boolean(executeResult?.request_id) && (
            <Text size="1" className="text-blue-600 font-mono">
              {t('agent_assist.requestID')} {executeResult.request_id}
            </Text>
          )}
        </Flex>
      </Box>
    );
  }

  // Execute result (success/failure)
  if (executeResult) {
    const isSuccess = executeResult.success;
    
    return (
      <Box 
        className={`mt-4 rounded-lg border p-4 ${
          isSuccess 
            ? 'border-green-200 bg-green-50' 
            : 'border-red-200 bg-red-50'
        }`}
      >
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <Text 
              size="3" 
              weight="medium" 
              className={isSuccess ? 'text-green-800' : 'text-red-800'}
            >
              {executeResult.message}
            </Text>
          </Flex>
          
          {Boolean(executeResult.request_id) && (
            <Text size="1" className="text-gray-600 font-mono">
              {t('agent_assist.requestID')} {executeResult.request_id}
            </Text>
          )}
          
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="w-fit cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('agent_assist.continueChat')}
          </Button>
        </Flex>
      </Box>
    );
  }

  // Confirmation card (initial state after prepare)
  if (prepareResult?.success) {
    return (
      <Box className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <Flex direction="column" gap="4">
          {/* Header */}
          <Flex align="center" gap="2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <Text size="3" weight="medium" className="text-amber-800">
              {t('agent_assist.confirmAction')}
            </Text>
          </Flex>

          {/* Action details */}
          <Flex direction="column" gap="2" className="rounded-md bg-white p-3 border border-amber-100">
            <Text size="2" weight="medium" className="text-gray-800">
              {prepareResult.action_name}
            </Text>
            <Text size="1" className="text-gray-600">
              {prepareResult.action_description}
            </Text>
          </Flex>

          {/* Device info */}
          {prepareResult.device && (
            <Flex direction="column" gap="2" className="rounded-md bg-white p-3 border border-amber-100">
              <Flex align="center" gap="2">
                <Monitor className="h-4 w-4 text-gray-500" />
                <Text size="2" weight="medium" className="text-gray-800">
                  {t('agent_assist.targetDevice')}
                </Text>
              </Flex>
              <Flex direction="column" gap="1" className="pl-6">
                <Text size="2" className="text-gray-700">
                  <span className="text-gray-500">{t('agent_assist.name')}</span> {prepareResult.device.device_name}
                </Text>
                <Text size="2" className="text-gray-700">
                  <span className="text-gray-500">{t('agent_assist.os')}</span> {prepareResult.device.os_type}
                </Text>
                {Boolean(prepareResult.device.user_name) && (
                  <Flex align="center" gap="1">
                    <User className="h-3 w-3 text-gray-400" />
                    <Text size="1" className="text-gray-500">
                      {prepareResult.device.user_name}
                    </Text>
                  </Flex>
                )}
              </Flex>
            </Flex>
          )}

          {/* Warning */}
          {prepareResult.requires_confirmation && (
            <Text size="1" className="text-amber-700">
              {t('agent_assist.actionWillBeExecuted')}
            </Text>
          )}

          {/* Action buttons */}
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
              onClick={onConfirm}
              disabled={isLoading}
              className="cursor-pointer bg-amber-600 text-white hover:bg-amber-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {t('agent_assist.executingAction')}
                </>
              ) : (
                t('agent_assist.confirmAndExecute')
              )}
            </Button>
          </Flex>
        </Flex>
      </Box>
    );
  }

  return null;
}

export default ActionConfirmation;

