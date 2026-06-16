'use client';
import React, { useState } from 'react';
import { ChevronDownIcon, CalendarIcon, RefreshCcw, GraduationCap } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@radix-ui/react-dropdown-menu';
import { Button, Flex, Text } from '@radix-ui/themes';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, subDays } from 'date-fns';
import { useRouter } from 'next/navigation';

export interface LearnerGroup {
  name: string;
  learners: number;
}

export interface ModuleCategory {
  name: string;
  modules: number;
}

interface TrainAssistFilterBarProps {
  onDashboardChange?: (dashboard: string) => void;
  onTimePeriodChange?: (period: string) => void;
  onDateChange?: (start: Date | null, end: Date | null) => void;
  onRefresh?: () => void;
  startDate?: Date | null;
  endDate?: Date | null;
  isRefreshing?: boolean;
  selectedDashboard?: string;
}

const TrainAssistFilterBar: React.FC<TrainAssistFilterBarProps> = ({
  onDashboardChange,
  onTimePeriodChange,
  onDateChange,
  onRefresh,
  startDate = subDays(new Date(), 30),
  endDate = new Date(),
  isRefreshing = false,
  selectedDashboard = 'Train Assist Dashboard',
}) => {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState('30 days');
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  const [isEndDateCalendarOpen, setIsEndDateCalendarOpen] = useState(false);

  const dashboardOptions = [
    'Train Assist Dashboard'
  ];

  const handleDashboardChange = (dashboard: string) => {
    setIsDashboardOpen(false);
    onDashboardChange?.(dashboard);
  };

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    const newEndDate = new Date();
    const days = period === '7 days' ? 7 : period === '30 days' ? 30 : 90;
    const newStartDate = subDays(newEndDate, days);
    onDateChange?.(newStartDate, newEndDate);
    onTimePeriodChange?.(period);
  };

  const handleStartDateChange = (date: Date | null) => {
    onDateChange?.(date, endDate);
    setIsStartDateCalendarOpen(false);
  };

  const handleEndDateChange = (date: Date | null) => {
    onDateChange?.(startDate, date);
    setIsEndDateCalendarOpen(false);
  };

  const handleRefresh = () => {
    onRefresh?.();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-lg shadow border-b border-gray-200">
      {/* Left Side - Dashboard Selector and Filters */}
      <div className="flex gap-4 items-center">
        {/* Dashboard Selector */}
        <DropdownMenu open={isDashboardOpen} onOpenChange={setIsDashboardOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center space-x-2 px-4 py-2 text-lg font-medium text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
              <span>{selectedDashboard}</span>
              <ChevronDownIcon className="w-5 h-5 text-gray-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 p-2 bg-white border rounded-lg shadow-lg z-50">
            <div className="py-1">
              {dashboardOptions.map((option) => (
                <DropdownMenuItem 
                  key={option}
                  className="p-0 focus:bg-transparent outline-none"
                  onSelect={() => handleDashboardChange(option)}
                >
                  <div className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded transition-colors cursor-pointer ${
                    selectedDashboard === option ? 'bg-gray-50 text-indigo-600' : 'text-gray-700'
                  }`}>
                    {option}
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right Side - Time Controls and Actions */}
      <div className="flex items-center gap-2">
        {/* <Flex align="center" gap="1">
          <Button
            variant="soft"
            color="gray"
            className={`cursor-pointer ${isRefreshing ? 'opacity-50' : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCcw size={16} className={`mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </Button>

          <Button
            variant={selectedPeriod === '7 days' ? 'solid' : 'soft'} 
            color={selectedPeriod === '7 days' ? 'iris' : 'gray'}
            className="cursor-pointer"
            onClick={() => handlePeriodChange('7 days')}
          >
            7 days
          </Button>
          <Button
            variant={selectedPeriod === '30 days' ? 'solid' : 'soft'}
            color={selectedPeriod === '30 days' ? 'iris' : 'gray'}
            className="cursor-pointer"
            onClick={() => handlePeriodChange('30 days')}
          >
            30 days
          </Button>
          <Button
            variant={selectedPeriod === '90 days' ? 'solid' : 'soft'}
            color={selectedPeriod === '90 days' ? 'iris' : 'gray'}
            className="cursor-pointer"
            onClick={() => handlePeriodChange('90 days')}
          >
            90 days
          </Button>
        </Flex>

        <Flex className="relative" gap="1">
          <Button
            variant="soft"
            color="gray"
            className="min-w-[140px] cursor-pointer"
            onClick={() => setIsStartDateCalendarOpen(!isStartDateCalendarOpen)}
          >
            <CalendarIcon size={16} className="mr-1"/>
            {startDate ? format(startDate, 'MMM dd, yyyy') : 'Start date'}
          </Button>
          <Button
            variant="soft"
            color="gray"
            className="min-w-[140px] cursor-pointer"
            onClick={() => setIsEndDateCalendarOpen(!isEndDateCalendarOpen)}
          >
            <CalendarIcon size={16} className="mr-1"/>
            {endDate ? format(endDate, 'MMM dd, yyyy') : 'End date'}
          </Button>

          {isStartDateCalendarOpen && (
            <div className="absolute right-0 top-[100%] z-50 mt-1">
              <DatePicker
                selected={startDate}
                onChange={handleStartDateChange}
                onClickOutside={() => setIsStartDateCalendarOpen(false)}
                startDate={startDate}
                endDate={endDate}
                selectsStart
                inline
                maxDate={endDate || new Date()}
                dateFormat="MMM dd, yyyy"
                calendarClassName="range-calendar bg-white border rounded shadow-lg"
              />
            </div>
          )}
          {isEndDateCalendarOpen && (
            <div className="absolute right-0 top-[100%] z-50 mt-1">
              <DatePicker
                selected={endDate}
                onChange={handleEndDateChange}
                onClickOutside={() => setIsEndDateCalendarOpen(false)}
                startDate={startDate}
                endDate={endDate}
                selectsEnd
                inline
                minDate={startDate}
                maxDate={new Date()}
                dateFormat="MMM dd, yyyy"
                calendarClassName="range-calendar bg-white border rounded shadow-lg"
              />
            </div>
          )}
        </Flex> */}

        {/* All Learners Button */}
        <Button variant="solid" color="iris" onClick={() => router.push('/train-assist')}>
          <GraduationCap size={16} className="mr-1"/>
          All Learners
        </Button>
      </div>
    </div>
  );
};

export default TrainAssistFilterBar; 