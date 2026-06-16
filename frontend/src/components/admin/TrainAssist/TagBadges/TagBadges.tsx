import React from 'react';
import { Tag, Tags } from 'lucide-react';
import AddTag from '@/components/admin/TrainAssist/AddTag/AddTag';
import { Flex } from '@radix-ui/themes';

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
interface TagBadgesProps {
  tags?: { id: string; name: string }[];
  collection: CollectionItem;
  availableTags: CollectionTag[];
  onUpdateTags: (collectionId: string, tagIds: string[]) => Promise<void>;
  onCreateTag: (name: string) => Promise<CollectionTag | null>;
}

const TagBadges: React.FC<TagBadgesProps> = ({
  tags,
  collection,
  availableTags,
  onUpdateTags,
  onCreateTag,
}) => {
  const visibleTags = tags && tags.length > 0 ? tags.slice(0, 3) : [];
  const extraCount = tags && tags.length > 0 ? tags.length - visibleTags.length : 0;

  // If no tags, show the icon/text as the trigger
  if (!tags || tags.length === 0) {
    return (
      <AddTag
        collection={collection}
        availableTags={availableTags}
        onUpdateTags={onUpdateTags}
        onCreateTag={onCreateTag}
        triggerContent={
          <div className="flex cursor-pointer items-center gap-1 text-sm text-[#8C9199]">
            <Tag size={14} strokeWidth={1.5} />
            <span className="cursor-pointer text-xs font-normal text-neutral-l2">
              Click to assign Tags
            </span>
          </div>
        }
      />
    );
  }

  // If tags exist, show the badges as the trigger
  return (
    <AddTag
      collection={collection}
      availableTags={availableTags}
      onUpdateTags={onUpdateTags}
      onCreateTag={onCreateTag}
      triggerContent={
        <Flex gap="2" wrap={'nowrap'} className="max-w-full overflow-hidden">
          {visibleTags.map((tag, index) => (
            <span
              key={tag.id}
              style={{
                marginLeft: index === 0 ? 0 : `-24px`,
                zIndex: 10 + index,
              }}
            >
              <span
                className="flex h-5 items-center 
  justify-start overflow-hidden 
  text-ellipsis whitespace-nowrap
  rounded-sm bg-[#EDF2FE] px-[6px] 
  py-[2px] text-sm font-medium 
  text-[#2957D2]
  shadow-[0px_0px_0px_0.5px_rgba(0,0,0,0.05),0px_1px_4px_rgba(0,0,0,0.05),0px_2px_1px_-1px_rgba(0,0,0,0.05),0px_1px_3px_rgba(0,0,0,0.1)]"
                title={tag.name} // Optional: tooltip for full name
              >
                {tag.name}
              </span>
            </span>
          ))}
          {extraCount > 0 && (
            <span className="text-sm font-medium text-[#1C2024]">+{extraCount}</span>
          )}
        </Flex>
      }
    />
  );
};

export default TagBadges;
