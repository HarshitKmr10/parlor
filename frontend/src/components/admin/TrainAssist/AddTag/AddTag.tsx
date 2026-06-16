import React, { useState, useCallback, useMemo } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Tag } from 'lucide-react';
import { Button, Text } from '@radix-ui/themes';

interface CollectionTag {
  id: string;
  name: string;
  description?: string | null;
  org_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface CollectionItem {
  id: string;
  name: string;
  source: string;
  source_config?: Record<string, any> | null;
  count?: number;
  tags?: CollectionTag[];
  [key: string]: any;
}

interface AddTagProps {
  collection: CollectionItem;
  availableTags: CollectionTag[];
  onUpdateTags: (collectionId: string, tagIds: string[]) => Promise<void>;
  onCreateTag: (name: string) => Promise<CollectionTag | null>;
  triggerContent?: React.ReactNode;
  scrollContainerRef?: React.RefObject<HTMLElement>;
}

const AddTag: React.FC<AddTagProps> = ({
  collection,
  availableTags,
  onUpdateTags,
  onCreateTag,
  triggerContent,
  scrollContainerRef,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    (collection.tags || []).map((tag) => tag.id),
  );
  const [isSaving, setIsSaving] = useState(false);

  const filteredTags = useMemo(() => {
    return availableTags.filter((tag) => tag.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [availableTags, searchTerm]);

  const exactMatchExists = useMemo(() => {
    return filteredTags.some((tag) => tag.name.toLowerCase() === searchTerm.toLowerCase());
  }, [filteredTags, searchTerm]);

  const handleDropdownOpenChange = useCallback(
    (open: boolean) => {
      setDropdownOpen(open);
      if (open) {
        setSelectedTagIds((collection.tags || []).map((tag) => tag.id));
      }
    },
    [collection.tags],
  );

  const toggleTagSelection = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);

  

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      await onUpdateTags(collection.id, selectedTagIds);
      setDropdownOpen(false);
    } finally {
      setIsSaving(false);
    }
  }, [onUpdateTags, collection.id, selectedTagIds]);

  const handleCancel = useCallback(() => {
    setDropdownOpen(false);
  }, []);

  return (
    <DropdownMenu.Root open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
      <DropdownMenu.Trigger asChild>
        {triggerContent}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal container={scrollContainerRef?.current || undefined}>
        <DropdownMenu.Content className="z-50 w-80 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <input
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-iris-8"
              placeholder="Search Tower"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {filteredTags.map((tag) => (
              <DropdownMenu.Item
                key={tag.id}
                onSelect={(e) => e.preventDefault()}
                className={`mb-1 mt-2 flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-gray-100 ${
                  selectedTagIds.includes(tag.id) ? 'bg-indigo-50' : ''
                }`}
              >
                <div
                  className="flex w-full items-center gap-2"
                  onClick={() => toggleTagSelection(tag.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedTagIds.includes(tag.id)}
                    readOnly
                    className="mr-1 rounded-md accent-[var(--iris-9)]"
                  />
                  <Text size="2" className="truncate text-gray-900">
                    {tag.name}
                  </Text>
                </div>
              </DropdownMenu.Item>
            ))}
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button
              className="rounded bg-[var(--iris-9)] px-3 py-1 text-xs text-white"
              color="iris"
              onClick={handleSave}
              disabled={isSaving}
              size="2"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              className="rounded bg-gray-200 px-3 py-1 text-xs"
              onClick={handleCancel}
              size="2"
            >
              Cancel
            </Button>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default AddTag;
