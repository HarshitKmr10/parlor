import React from 'react';
import { Box, Tooltip } from '@radix-ui/themes';
import NoPriorityIcon from '@/components/icons/NoPriorityIcon';
import { LANGUAGE_NAMES, LANGUAGE_FLAGS } from '@/config/flags';

interface LanguageFlagProps {
  languageCode: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const sizeMap = {
  sm: { width: '16px', height: '12px' },
  md: { width: '20px', height: '14px' },
  lg: { width: '24px', height: '16px' },
};

export const LanguageFlag: React.FC<LanguageFlagProps> = ({
  languageCode,
  size = 'md',
  showTooltip = true,
  className,
  style,
}) => {
  const hasMapping = Boolean(LANGUAGE_FLAGS[languageCode]);
  const [loadError, setLoadError] = React.useState(!hasMapping);
  const flagCode = LANGUAGE_FLAGS[languageCode] || languageCode;
  const languageName = LANGUAGE_NAMES[languageCode] || languageCode;
  const dimensions = sizeMap[size];

  const widthNum = parseInt(dimensions.width, 10);
  const heightNum = parseInt(dimensions.height, 10);

  const fallbackElement = (
    <NoPriorityIcon
      width={widthNum}
      height={heightNum}
      className={className}
      style={style}
      ariaLabel={languageName}
    />
  );

  const flagElement = loadError ? (
    fallbackElement
  ) : (
    <img
      src={`https://flagcdn.com/${flagCode}.svg`}
      alt={languageName}
      style={{
        ...dimensions,
        border: '1px solid #e0e0e0',
        borderRadius: '2px',
        ...style,
      }}
      className={className}
      onError={() => setLoadError(true)}
    />
  );

  if (showTooltip) {
    return (
      <Tooltip content={languageName}>
        <Box style={{ display: 'inline-block' }}>
          {flagElement}
        </Box>
      </Tooltip>
    );
  }

  return flagElement;
};

interface LanguageFlagsListProps {
  languages: string[];
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  maxDisplay?: number;
  showCount?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const LanguageFlagsList: React.FC<LanguageFlagsListProps> = ({
  languages,
  size = 'md',
  showTooltip = true,
  maxDisplay = 5,
  showCount = true,
  className,
  style,
}) => {
  if (!languages || languages.length === 0) {
    return (
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          ...style,
        }}
        className={className}
      >
        <NoPriorityIcon width={parseInt(sizeMap[size].width, 10)} height={parseInt(sizeMap[size].height, 10)} />
      </Box>
    );
  }

  const displayLanguages = languages.slice(0, maxDisplay);
  const remainingCount = languages.length - maxDisplay;

  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        ...style,
      }}
      className={className}
    >
      {displayLanguages.map((lang, index) => (
        <LanguageFlag
          key={`${lang}-${index}`}
          languageCode={lang}
          size={size}
          showTooltip={showTooltip}
        />
      ))}
      {remainingCount > 0 && showCount && (
        <Box
          style={{
            color: '#6b7280',
            fontSize: '12px',
            marginLeft: '4px',
          }}
        >
          +{remainingCount}
        </Box>
      )}
    </Box>
  );
};

export default LanguageFlag;
