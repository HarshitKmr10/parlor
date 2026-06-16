// dashboardData.js
import moment from 'moment';
import i18n from '../../../../../helper/i18n';

// Default data when no dashboard data is provided
export const defaultCommonIssues = [
  {
    name: 'How to Fix Server Timeout',
    incidents: ['INC001', 'INC002', 'INC003', 'INC004', 'INC005', 'INC006'],
    category: 'Software',
  },
  {
    name: 'Database Connection Issues',
    incidents: ['INC007', 'INC008', 'INC009', 'INC010', 'INC011', 'INC012'],
    category: 'Database',
  },
  {
    name: 'Server Crash on Startup',
    incidents: ['INC013', 'INC014', 'INC015', 'INC016', 'INC017', 'INC018'],
    category: 'Server',
  },
  {
    name: 'Hardware Failure Detection',
    incidents: ['INC019', 'INC020', 'INC021', 'INC022', 'INC023', 'INC024'],
    category: 'Hardware',
  },
  {
    name: 'Server Crash on Startup',
    incidents: ['INC025', 'INC026', 'INC027', 'INC028', 'INC029', 'INC030'],
    category: 'Server',
  },
];

export const defaultKbQualityData = [
  {
    date: 'Sept 1',
    deduplicatedKBs: 140,
    createdKBs: 50,
    totalKBs: 150,
  },
  {
    date: 'Sept 2',
    deduplicatedKBs: 130,
    createdKBs: 50,
    totalKBs: 140,
  },
  {
    date: 'Sept 7',
    deduplicatedKBs: 90,
    createdKBs: 50,
    totalKBs: 100,
  },
  {
    date: 'Sept 10',
    deduplicatedKBs: 100,
    createdKBs: 55,
    totalKBs: 110,
  },
  {
    date: 'Sept 14',
    deduplicatedKBs: 100,
    createdKBs: 50,
    totalKBs: 120,
  },
  {
    date: 'Sept 20',
    deduplicatedKBs: 50,
    createdKBs: 60,
    totalKBs: 130,
  },
  {
    date: 'Sept 28',
    deduplicatedKBs: 0,
    createdKBs: 65,
    totalKBs: 150,
  },
];



export const defaultKbQualityDataEmpty = [
  {
    date: moment().subtract(3, 'days').format('MMM D'),
    deduplicatedKBs: 0,
    createdKBs: 0,
    totalKBs: 0,
  },
  {
    date: moment().subtract(2, 'days').format('MMM D'),
    deduplicatedKBs: 0,
    createdKBs: 0,
    totalKBs: 0,
  },
  {
    date: moment().subtract(1, 'days').format('MMM D'),
    deduplicatedKBs: 0,
    createdKBs: 0,
    totalKBs: 0,
  },
  {
    date: moment().format('MMM D'),
    deduplicatedKBs: 0,
    createdKBs: 0,
    totalKBs: 0,
  }
];

export const defaultTranslationRecommendation = {
  id: 'f7e9a123-4b5c-6d7e-8f9a-0b1c2d3e4f5g',
  recommendation:
    'We have identified top 2 used articles that needs to be translated to Spanish language.',
  type: 'translate',
  rank: 1,
  related_to_kb_ids: [
    {
      id: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6',
      title: 'Investigating Slow System Performance',
      access_url:
        'https://knowledgebasestaging.blob.core.windows.net/knowledgebaseassist/c42ad28d-098c-4d02-a271-9117a5bda3e7/15535ee4-7c38-485d-adea-fe0b250e35bd/Investigating%20Slow%20System%20Performance%20%28Version%202%29.pdf',
    },
    {
      id: 'b2c3d4e5-f6g7-h8i9-j0k1-l2m3n4o5p6q7',
      title: 'Password Reset - Remote Desktop Assistance.pdf',
      access_url:
        'https://knowledgebasestaging.blob.core.windows.net/knowledgebaseassist/c42ad28d-098c-4d02-a271-9117a5bda3e7/15535ee4-7c38-485d-adea-fe0b250e35bd/Password%20Reset%20-%20Remote%20Desktop%20Assistance.pdf',
    },
  ],
  metadata: null,
};

// Helper functions to get dashboard data
export function getDashboardStats(dashboardData) {
  const t = i18n.t;
  const ticketFeaturesEnabled = dashboardData?.ticket_features_enabled !== false;
  
  const baseStats = [
    {
      key: 'duplicate_articles',
      label: t('knowledge_assist.duplicateArticles'),
      value: dashboardData?.total_duplicate_documents || '0',
      tooltip: t('knowledge_assist.duplicateArticlesTooltip'),
    },
    {
      key: 'articles_without_translation',
      label: t('knowledge_assist.articlesWithoutTranslation'),
      value: dashboardData?.total_missing_translations || '0',
      tooltip: t('knowledge_assist.articlesWithoutTranslationTooltip'),
    },
    {
      key: 'low_scoring',
      label: t('knowledge_assist.lowScoring'),
      value: dashboardData?.low_scoring_articles?.length || '0',
      tooltip: t('knowledge_assist.lowScoringTooltip'),
    },
  ];

  // Hide ticket-derived cards when ticket features are permission-gated for this user.
  if (ticketFeaturesEnabled) {
    baseStats.push({
      key: 'new_documents_from_tickets',
      label: t('knowledge_assist.newDocumentsFromTickets'),
      value: dashboardData?.create_new_kb_recommendations_count || '0',
      tooltip: t('knowledge_assist.newDocumentsFromTicketsTooltip'),
    });
  }

  // Only add these stats if both keys are integers
  const hasUnlinkedTickets = ticketFeaturesEnabled && Number.isInteger(dashboardData?.unlinked_incidents_count);
  const hasMissedKBLinks = ticketFeaturesEnabled && Number.isInteger(dashboardData?.missed_linked_incidents_count);
  
  if (hasUnlinkedTickets && hasMissedKBLinks) {
    baseStats.push(
      {
        key: 'tickets_without_kb',
        label: t('knowledge_assist.ticketsWithoutKB'),
        value: dashboardData?.unlinked_incidents_count || '0',
        tooltip: t('knowledge_assist.ticketsWithoutKBTooltip'),
      },
      {
        key: 'tickets_missing_kb_links',
        label: t('knowledge_assist.ticketsMissingKBLinks'),
        value: dashboardData?.missed_linked_incidents_count || '0',
        tooltip: t('knowledge_assist.ticketsMissingKBLinksTooltip'),
      }
    );
  }

  return baseStats;
}

export function getLowScoringArticles(dashboardData) {
  return (
    dashboardData?.low_scoring_articles || []
  );
}

export function getRecommendations(dashboardData) {
  return [
    ...(dashboardData?.recommendations || []),
    // defaultTranslationRecommendation,
  ];
}

export function getCommonIssues(commonIssuesData) {
  return [
    ...(commonIssuesData?.data || []),
    // defaultTranslationRecommendation,
  ];
}

// export function getKbQualityData(dashboardData) {
//   return dashboardData?.kb_quality_data || defaultKbQualityData;
// }

export function generateDynamicKbQualityData(dashboardData) {
  const kbQualityData = [];
  const todayTotalKBs = dashboardData?.total_documents || 150; // Use total_documents for today's total KBs
  const todayDeduplicatedKBs = Math.round(
    dashboardData?.total_duplicate_documents * 0.6
  ); // 60% of total_duplicate_documents
  let yesterdayCreatedKBs = 0;

  for (let i = 0; i <= 9; i++) {
    const date = moment().subtract(i, 'days').format('MMM D');
    let totalKBs, deduplicatedKBs, createdKBs;

    if (i === 0) {
      // Today's data - use real data or estimates
      totalKBs = todayTotalKBs;
      deduplicatedKBs = todayDeduplicatedKBs;
      createdKBs = Math.round(todayTotalKBs * 0.07); // Use a fixed 7% for createdKBs today
      yesterdayCreatedKBs = createdKBs;
    } else {
      // Previous days - ensure non-increasing/non-decreasing trends (deterministic)

      // 1. totalKBs: Non-increasing as we go back
      totalKBs = Math.round(kbQualityData[i - 1].totalKBs * 0.98); // Fixed 2% decrease
      // No need for the check, it will always be less than or equal to the previous day

      // 2. deduplicatedKBs: Non-decreasing as we go back
      deduplicatedKBs = Math.round(
        kbQualityData[i - 1].deduplicatedKBs * 0.9
      );

      // 3. createdKBs: Non-increasing as we go back
      createdKBs = Math.round(yesterdayCreatedKBs * 0.7); // Fixed 30% decrease
      // No need for the check, it will always be less than or equal to yesterday's value
    }

    kbQualityData.push({
      date,
      deduplicatedKBs: deduplicatedKBs > 0 ? deduplicatedKBs : 0,
      createdKBs,
      totalKBs,
    });
    yesterdayCreatedKBs = createdKBs;
  }

  return kbQualityData.reverse();
}

// Use the dynamic function in getKbQualityData
export function getKbQualityData(dashboardData) {
  return dashboardData?.kb_quality_data || [];
}

// Function to get filter options
export function getFilterOptions() {
  const t = i18n.t;
  
  return {
    categories: [
      t('common.filters.all'), 
      t('common.filters.software'), 
      t('common.filters.database'), 
      t('common.filters.server'), 
      t('common.filters.hardware')
    ],
    timeRanges: [
      t('common.filters.last7Days'), 
      t('common.filters.last30Days'), 
      t('common.filters.last90Days'), 
      t('common.filters.allTime')
    ],
    statuses: [
      t('common.filters.all'), 
      t('common.filters.active'), 
      t('common.filters.resolved'), 
      t('common.filters.pending')
    ],
  };
}
