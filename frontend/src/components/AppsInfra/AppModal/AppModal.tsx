'use client';

// ─── React & State ─────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo } from 'react';

// ─── UI Components ─────────────────────────────────────────────────────
import { Dialog, Text, Button, TextField, Flex } from '@radix-ui/themes';
import { Plus, Loader2 } from 'lucide-react';

// ─── Custom Hooks & Utilities ──────────────────────────────────────────
import { useAppsInfraStore } from 'store/AppAndInfra/AppInfra';
import { createSessionApi } from 'api/sessions';

// ─── Icons ─────────────────────────────────────────────────────────────
import AppBotIcon from 'components/icons/AppBotIcon';
import { useParams, useRouter } from 'next/navigation';
import { useGlobalContext } from 'contexts/store';
import classNames from 'classnames';

// ─── Component ─────────────────────────────────────────────────────────
const AppModal: React.FC = () => {
  const { user } = useGlobalContext();
  const org_id = user?.org_id;
  const { incidentId } = useParams();
  const router = useRouter();

  const apps = useAppsInfraStore((s) => s.apps);
  const fetchApps = useAppsInfraStore((s) => s.fetchApps);
  const refetch = useAppsInfraStore((s) => s.refetch);

  const [open, setOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionNameInput, setSessionNameInput] = useState<string>('');

  // ─── Fetch Apps When Modal Opens ─────────────────────────────────────
  useEffect(() => {
    if (open && apps.length === 0) fetchApps();
  }, [open]);

  // ─── Handle Create Session ───────────────────────────────────────────
  const handleContinue = async () => {
    const selectedApp = apps.find((a) => a.id === selectedAppId);
    if (!selectedApp || !sessionNameInput.trim()) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      const response = await createSessionApi(sessionNameInput.trim(), 'incident', selectedApp.id, {
        sessionOrigin: 'MANUAL',
        sessionVisibility: 'PRIVATE',
        related_record_type: 'incident',
        related_record_id: incidentId as unknown as string,
        org_id: org_id,
        chat_available: true,
      });

      // Reset state
      setOpen(false);
      setSelectedAppId(null);
      setSearchQuery('');
      setSessionNameInput('');
      refetch();
      await refetch();
      setTimeout(() => {
        router.push(
          `/apps/incidents/${incidentId}/${response?.id}?sessionName=${sessionNameInput.trim()}&appName=${selectedApp?.name}&appId=${selectedApp.id}`,
        );
      }, 500);
    } catch (err: any) {
      console.error('Failed to create session:', err);
      setErrorMsg(err?.message || 'Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Filtered App List Based on Search ───────────────────────────────
  const filteredApps = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return apps.filter(
      (app) => app.name.toLowerCase().includes(q) || app.description?.toLowerCase().includes(q),
    );
  }, [apps, searchQuery]);

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setSelectedAppId(null);
        setErrorMsg(null);
      }}
    >
      <Dialog.Trigger>
        <Button className="cursor-pointer bg-[#6C5DD3] text-sm text-white hover:bg-[#5648B3]">
          <Plus className="mr-2 h-3 w-3" />
          New Chat
        </Button>
      </Dialog.Trigger>

      <Dialog.Content className="w-[450px] rounded-xl p-6 shadow-lg">
        {/* Header */}
        <div className="mb-3">
          <Text weight="bold" size="6">
            Select an Agent
          </Text>
        </div>
        <Text size="2" className="mb-6 text-[#1C2024]">
          Start troubleshooting with specific agent to resolve issue quickly.
        </Text>


        <TextField.Root
          disabled={loading}
          placeholder="Search for an Agent"
          className="w-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* App List */}
        <div className="mt-4 max-h-[300px] space-y-3 overflow-y-auto">
          {filteredApps.length === 0 ? (
            <Text size="2" color="gray">
              No apps found.
            </Text>
          ) : (
            filteredApps.map((app) => (
              <Flex
                key={app.id}
                align="start"
                onClick={() => setSelectedAppId(app.id)}
                className={classNames(
                  'mb-3 cursor-pointer gap-3 rounded-lg border border-iris-9 p-3 hover:bg-iris-3',
                  selectedAppId === app.id && 'bg-iris-3',
                )}
              >
                <Flex align="center" justify="center" className='w-10'>
                  <AppBotIcon />
                </Flex>
                <Flex direction="column" align="start" className="min-w-0">
                  <Text size="2" weight="bold" className="truncate text-iris-9">
                    {app?.name || ''}
                  </Text>
                  <Text size="1" className="font-medium leading-4 text-[#002BB7C5] line-clamp-1">
                    {app?.description || ''}
                  </Text>
                </Flex>
              </Flex>
            ))
          )}
        </div>

        {/* Error Message */}
        {!!errorMsg && (
          <Text color="red" size="2" className="mt-2">
            {errorMsg}
          </Text>
        )}

        {/* Footer Actions */}
        <Flex direction={'column'} justify="end" gap="2" className="mt-2 border-t-1">
          <Text weight="light" size="3" className="mb-2 mt-4">
            Session Name <span className="text-red-500">*</span>
          </Text>
          <TextField.Root
            disabled={loading}
            placeholder="Eg: App Downtime Debugging"
            className="w-full"
            value={sessionNameInput}
            onChange={(e) => setSessionNameInput(e.target.value)}
          />
          <Flex gap="2" className="mt-2">
            <Button
              variant="soft"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedAppId || !sessionNameInput.trim()}
              className={`cursor-pointer text-white ${!selectedAppId || !sessionNameInput.trim() || (loading && `cursor-not-allowed`)}`}
              onClick={!loading && handleContinue}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Creating...' : 'Continue'}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default AppModal;
