import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from 'components/common/Dialog';
import { Select, Button, Flex, Text, TextField } from '@radix-ui/themes';

interface CreateSessionButtonProps {
  onCreateSession: (name: string, type: string, options?: { integrationIds?: string[], sessionOrigin?: string, sessionVisibility?: string, related_record_type?: 'adhoc' | 'change' | 'incident' }) => Promise<void>
}

export const CreateSessionButton: React.FC<CreateSessionButtonProps> = ({ onCreateSession }) => {

  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'TEAM' | 'PUBLIC'>('PRIVATE');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [type, setType] = useState<'adhoc'>('adhoc');

  const handleCreate = async () => {
    if (name && visibility) {
      try {
        setIsLoading(true);
        await onCreateSession(name, type, {
          integrationIds: [],
          sessionOrigin: 'MANUAL',
          sessionVisibility: visibility,
          related_record_type: type,
        });
        setName('');
        setType('adhoc');
        setIsOpen(false);
      } catch (error) {
        console.error('Error creating session:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="3" radius="medium">+ New Session</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
        </DialogHeader>
        <Flex direction="column" gap="2" className="my-4">
          <Flex direction="column" gap="1">
            <Text size="2" className="text-gray-9" weight="bold">
              Name
            </Text>
            <TextField.Root
              size="2"
              onChange={(e) => setName(e.target.value)}
              name={name}
              className="rounded-md p-2"
              value={name}
              placeholder="E.g. Database outage"
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="2" weight="bold" className="text-gray-9">Type</Text>
            <Select.Root defaultValue="adhoc" name="type" onValueChange={(value) => setType(value as 'adhoc')}>
                <Select.Trigger className='rounded-md p-2' />
                <Select.Content className='z-50'>
                    <Select.Item value="adhoc">Adhoc</Select.Item>
                </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>
        <Button size="3" radius="medium" onClick={handleCreate} disabled={!name || isLoading}>
          {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null} 
          {isLoading ? 'Creating...' : 'Create Session'}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

