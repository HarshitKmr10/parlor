import React from 'react';
import { DropdownMenu } from '@radix-ui/themes';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { Loader2 } from 'lucide-react';
import { LANGUAGE_FLAGS, LANGUAGE_NAMES } from '@/config/flags';

interface Props {
  languages: string[];
  label: string;
  onSelect: (langCode: string) => void;
  isLoading?: boolean;
  loadingKey?: string | null;
  articleId?: string;
}

const KbTranslateButton: React.FC<Props> = ({ languages, label, onSelect, isLoading = false, loadingKey = null, articleId }) => {
  const isDisabled = !languages || languages.length === 0;

  const isButtonLoading = isLoading;
  const isButtonDisabled = isDisabled || isButtonLoading;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger disabled={isButtonDisabled}>
        <button
          style={{
            padding: '4px 8px',
            borderRadius: '6px',
            backgroundColor: 'rgba(239, 246, 255, 0.9)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: isButtonDisabled ? '#A1A1AA' : '#4F46E5',
            border: 'none',
            cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            opacity: isButtonDisabled ? 0.6 : 1,
          }}
          className={isButtonDisabled ? '' : 'hover:bg-[rgba(239,246,255,1)]'}
          disabled={isButtonDisabled}
          onClick={(e) => e.stopPropagation()}
        >
          {isButtonLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" style={{ color: '#6366F1' }} />
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ color: isDisabled ? '#A1A1AA' : '#6366F1' }}
            >
              <path
                d="M3 5h12M9 3v2m1.048 4.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {label}
          {!isButtonLoading && (
            <ChevronDownIcon style={{ color: isDisabled ? '#A1A1AA' : '#6366F1', width: 12, height: 12 }} />
          )}
        </button>
      </DropdownMenu.Trigger>

      {!isDisabled && (
        <DropdownMenu.Content>
          {languages.map((lang) => {
            const isLangLoading = loadingKey === `${articleId}-${lang}`;
            return (
              <DropdownMenu.Item 
                key={lang} 
                onSelect={() => !isLangLoading && onSelect(lang)}
                disabled={isLangLoading}
              >
                <div className="flex items-center gap-2">
                  {isLangLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <img
                      src={`https://flagcdn.com/${LANGUAGE_FLAGS[lang] || lang}.svg`}
                      alt={LANGUAGE_NAMES[lang] || lang}
                      style={{
                        width: '20px',
                        height: '14px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '2px',
                      }}
                    />
                  )}
                  {LANGUAGE_NAMES[lang] || lang}
                </div>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      )}
    </DropdownMenu.Root>
  );
};

export default KbTranslateButton;


