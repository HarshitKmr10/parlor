export const comparisonSummaryStyles = {
  container: 'border border-gray-200 rounded-lg overflow-hidden shadow-sm',
  containerBackground: {
    background: `
      radial-gradient(71.35% 36.62% at 21.56% 16.17%, rgba(235, 195, 255, 0.25) 0%, rgba(235, 195, 255, 0) 100%),
      radial-gradient(48.09% 33.91% at 78.06% 17.24%, rgba(129, 198, 248, 0.25) 0%, rgba(129, 198, 248, 0) 100%)
    `.replace(/\s+/g, ' ').trim(),
  },
  header: {
    container: 'px-4 py-3',
    titleBox: 'flex items-center rounded-md px-2 gap-2',
    titleBoxStyle: {
      width: 'max-content',
      height: '24px',
      border: '1px solid #A7A1D3',
      borderRadius: '6px',
    },
    text: 'text-neutral-l1',
    rightSection: 'ml-auto',
    badge: 'bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium',
  },
  content: {
    container: 'px-4 pb-4',
    title: 'block mb-2 text-neutral-l3',
    description: 'block mb-4 text-neutral-l1',
  },
  highlights: {
    title: 'block mb-2 text-neutral-l3',
    list: 'list-none space-y-1 ml-0',
    item: 'text-sm !mt-0 text-neutral-l1',
  },
  metrics: {
    container: 'mt-4 flex items-center gap-2 flex-wrap',
    item: 'cursor-pointer px-4',
    itemStyle: {
      width: 'max-content',
      height: '25px',
      opacity: 1,
      borderRadius: '4px',
      border: '1px solid #E8E8E8',
    },
    label: 'text-[#646464] font-bold text-xs',
  },
} as const;

