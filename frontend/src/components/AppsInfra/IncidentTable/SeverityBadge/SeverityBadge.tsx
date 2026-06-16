import React from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import classNames from 'classnames';

type Severity = 'critical' | 'high' | 'medium' | 'low';

const severityStyles: Record<Severity, string> = {
  critical: 'bg-[#C40006D3] text-white',
  high: 'bg-[#C40006D3] text-white',
  medium: 'bg-[#AB6400] text-white',
  low: 'bg-[#0007149F] text-white',
};

const unknownStyle = 'bg-[#0000330F] text-[#0007149F]';

// Extended synonym map
const severitySynonyms: Record<string, Severity> = {
  // Critical
  critical: 'critical',
  blocker: 'critical',
  fatal: 'critical',
  emergency: 'critical',
  urgent_critical: 'critical',
  'sev-1': 'critical',
  sev1: 'critical',
  p0: 'critical',
  '4': 'critical',
  'severity 4': 'critical',

  // High
  high: 'high',
  severe: 'high',
  major: 'high',
  urgent: 'high',
  escalate: 'high',
  escalated: 'high',
  'sev-2': 'high',
  sev2: 'high',
  p1: 'high',
  '3': 'high',
  'severity 3': 'high',

  // Medium
  medium: 'medium',
  moderate: 'medium',
  average: 'medium',
  normal: 'medium',
  warning: 'medium',
  'sev-3': 'medium',
  sev3: 'medium',
  p2: 'medium',
  '2': 'medium',
  'severity 2': 'medium',

  // Low
  low: 'low',
  minor: 'low',
  trivial: 'low',
  cosmetic: 'low',
  info: 'low',
  informational: 'low',
  notice: 'low',
  'sev-4': 'low',
  sev4: 'low',
  p3: 'low',
  '1': 'low',
  'severity 1': 'low',
};

export function normalizeSeverity(input: string): { severity: Severity; matched: boolean } {
  if (!input) return { severity: 'medium', matched: false };

  const key = input
    .toLowerCase()
    .trim()
    .replace(/_/g, '')
    .replace(/-/g, '')
    .replace(/\s+/g, '');

  const match = severitySynonyms[key];
  return {
    severity: match || 'medium',
    matched: !!match,
  };
}

const SeverityBadge = ({ level }: { level: string }) => {
  const { severity, matched } = normalizeSeverity(level);

  return (
    <span
      className={classNames(
        'rounded-md px-2 py-1 text-xs font-medium',
        matched ? severityStyles[severity] : unknownStyle
      )}
    >
      {level}
    </span>
  );
};

export default SeverityBadge;