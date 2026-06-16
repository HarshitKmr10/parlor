import classNames from 'classnames';

export const tabsRootClass = 'flex w-full py-2';

export const tabsListClass = classNames(
  'flex gap-1',
  'rounded-xl bg-gray-100 p-1 shadow-sm',
  'text-sm'
);

export const tabTriggerClass = classNames(
  'cursor-pointer',
  'flex items-center gap-4',
  'rounded-lg px-4 py-2',
  'font-medium text-dark-50',
  'transition-colors',
  'hover:bg-white hover:text-blue-700',
  'data-[state=active]:bg-white',
  'data-[state=active]:shadow-md',
  'data-[state=active]:text-blue-800',
);