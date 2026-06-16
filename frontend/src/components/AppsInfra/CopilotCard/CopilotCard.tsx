'use client';

// ─────────────────────────────────────────────────────────────
// React & TypeScript
// ─────────────────────────────────────────────────────────────
import React from 'react';

// ─────────────────────────────────────────────────────────────
// Radix UI & Lucide Icons
// ─────────────────────────────────────────────────────────────
import { Flex, Text, Box } from '@radix-ui/themes';
import { PlusIcon, ArrowRightIcon } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────
import classNames from 'classnames';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface CopilotCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  onClick?: () => void;
  isActive?: boolean;
  showArrow?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
const CopilotCard = ({
  icon,
  title,
  description,
  buttonText,
  onClick,
  showArrow = false,
}: CopilotCardProps): JSX.Element => {
  return (
    <Flex
      direction="column"
      gap="3"
      onClick={onClick}
      className={classNames(
        'min-w-90 w-[359px] h-[104px] cursor-pointer rounded-xl border bg-white p-3 transition-all',
      )}
    >
      <Flex align={'end'} justify={'between'}>
        {/* ─── Icon + Title ───────────────────────────── */}
        <Flex justify={"between"} className='gap-3 flex-1 w-[230px] flex-col'>
          <Flex align="center" gap="2">
            <div className="rounded-full bg-indigo-100 p-2">{icon}</div>
            <Text size="2" weight="medium" highContrast>
              {title}
            </Text>
          </Flex>

          {/* ─── Description ───────────────────────────── */}
          <Text size="1" color="gray">
            {description}
          </Text>
        </Flex>

        {/* ─── Action Button ─────────────────────────── */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent outer card click from firing
            onClick?.();
          }}
          className="mt-auto flex items-center gap-1 self-start rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        >
          {showArrow ? (
            <>
              {buttonText}
              <ArrowRightIcon size={14} />
            </>
          ) : (
            <>
              <PlusIcon size={14} />
              {buttonText}
            </>
          )}
        </button>
      </Flex>
    </Flex>
  );
};

export default CopilotCard;
