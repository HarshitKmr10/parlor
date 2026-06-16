'use client'; 
import React, { useState, useEffect, useCallback } from 'react';
import { FilterIcon, ChevronDownIcon, CalendarIcon, RefreshCcw, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@radix-ui/react-dropdown-menu';
import { Button, Flex, Text, Link, IconButton } from '@radix-ui/themes';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, subDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { TimeFrameType } from 'types/common'; 

export interface IssueCategory {
  name: string;
  issues: number;
}

export interface EmployeePersona {
  name: string;
  issues: number;
}

// Note: Employee personas are now fetched from /ticket-assist/tickets-by-department API via useEmployeeDepartments hook

interface TopFilterBarProps {
    categories: IssueCategory[]; // Use fetched categories
    selectedCategory: IssueCategory; 
    onSelectCategory: (category: IssueCategory) => void;
    employeePersonas: EmployeePersona[]; // Use fetched employee personas
    selectedEmployeePersona: EmployeePersona; 
    onSelectEmployeePersona: (persona: EmployeePersona) => void; 
    // Date range props - LIFTED
    startDate: Date | null;
    endDate: Date | null;
    selectedTimeFrameType: TimeFrameType;
    onDateChange: (start: Date | null, end: Date | null, type: TimeFrameType) => void;
    isRefreshing: boolean;
    onRefresh: () => void;
}

const TopFilterBar: React.FC<TopFilterBarProps> = ({ 
    // Destructure all props
    categories,
    selectedCategory,
    onSelectCategory,
    employeePersonas,
    selectedEmployeePersona,
    onSelectEmployeePersona,
    startDate,
    endDate,
    selectedTimeFrameType,
    onDateChange,
    isRefreshing,
    onRefresh
}) => {
  const router = useRouter();

  // --- Remove Local Date State & Logic --- 
  // const [startDate, setStartDate] = useState<Date | null>(subDays(new Date(), 7));
  // const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false); // Keep local state for calendar visibility
  const [isEndDateCalendarOpen, setIsEndDateCalendarOpen] = useState(false);
  // const [selectedTimeframeQuery, setSelectedTimeframeQuery] = useState(...); // Remove, not needed directly
  // const [selectedTimeFrameType, setSelectedTimeFrameType] = useState<TimeFrameType>('7D'); // Use prop
  // const [isRefreshing, setIsRefreshing] = useState(false); // Use prop

  // --- Use Prop Handlers for Date Changes --- 
  const handleStartDateChange = (date: Date | null) => {
    onDateChange(date, endDate, 'CUSTOM');
    setIsStartDateCalendarOpen(false);
  };

  const handleEndDateChange = (date: Date | null) => {
    onDateChange(startDate, date, 'CUSTOM');
    setIsEndDateCalendarOpen(false);
  };

  const handleTimeframeChange = (type: '7D' | '1M' | '3M') => {
    const newEndDate = new Date();
    const newStartDate = subDays(newEndDate, type === '7D' ? 7 : type === '1M' ? 30 : 90);
    onDateChange(newStartDate, newEndDate, type);
  };

  // --- End Date Logic Changes ---

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-lg shadow">
      {/* Left Side Dropdowns */}
      <div className="flex gap-4">
        {/* Category Dropdown - Use `categories` prop */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex flex-col items-start h-auto relative pr-8 min-w-[160px]">
              <span className="text-gray-500 text-xs">{selectedCategory.name}</span>
              <span className="font-semibold">{selectedCategory.issues.toLocaleString()} issues</span>
              <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-96 p-4 bg-white border rounded shadow-lg z-50">
              <DropdownMenuLabel className="text-lg font-semibold mb-2 text-gray-800">Select an Issue Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="grid grid-cols-3 gap-3 mt-3">
                {/* Use categories prop here */}
                {categories.map(category => ( 
                    <DropdownMenuItem 
                        key={category.name} 
                        className={`p-0 focus:bg-transparent outline-none`}
                        onSelect={() => onSelectCategory(category)} 
                    >
                        <div 
                            className={`flex flex-col items-start p-3 rounded-md border cursor-pointer transition-colors duration-150 
                            ${selectedCategory.name === category.name 
                                ? 'border-indigo-500 bg-indigo-50' 
                                : 'border-gray-200 hover:bg-gray-50'}
                            `}
                        >
                            <span className="font-medium text-sm text-gray-800">{category.name}</span>
                            <span className="text-xs text-gray-500">{category.issues.toLocaleString()} issues</span>
                        </div>
                    </DropdownMenuItem>
                ))}
              </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Employee Persona Dropdown (structure unchanged, uses props) */}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex flex-col items-start h-auto relative pr-8 min-w-[160px]">
                    <span className="text-gray-500 text-xs">{selectedEmployeePersona.name}</span>
                    <span className="font-semibold">{selectedEmployeePersona.issues.toLocaleString()} issues</span>
                    <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[500px] max-h-[400px] overflow-y-auto p-4 bg-white border rounded shadow-lg z-50">
                <Flex justify="between" align="center" mb="2">
                     <DropdownMenuLabel className="text-lg font-semibold text-gray-800 m-0">Select an Employee Persona</DropdownMenuLabel>
                     <Flex align="center" gap="3" className="text-xs">
                         <Text color="gray">Sort By:</Text>
                         <Link href="#" size="1">Issue Volume</Link>
                         <Text color="gray">|</Text>
                         <Link href="#" size="1">A-Z</Link>
                     </Flex>
                 </Flex>
                 <DropdownMenuSeparator />
                 <div className="grid grid-cols-3 gap-3 mt-3">
                    {employeePersonas.map(persona => (
                        <DropdownMenuItem 
                            key={persona.name} 
                            className={`p-0 focus:bg-transparent outline-none`}
                            onSelect={() => onSelectEmployeePersona(persona)}
                        >
                            <div 
                                className={`flex flex-col items-center justify-center text-center p-3 h-20 rounded-md border cursor-pointer transition-colors duration-150 
                                ${selectedEmployeePersona.name === persona.name 
                                    ? 'border-indigo-500 bg-indigo-50' 
                                    : 'border-gray-200 hover:bg-gray-50'}
                                `}
                            >
                                <span className="font-medium text-sm text-gray-800">{persona.name}</span>
                                <span className="text-xs text-gray-500">({persona.issues.toLocaleString()} Issues)</span>
                            </div>
                        </DropdownMenuItem>
                    ))}
                 </div>
             </DropdownMenuContent>
         </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">

        <Flex align="center" gap="1">
            <Button
                variant="soft"
                color="gray"
                className={`cursor-pointer ${isRefreshing ? 'opacity-50' : ''}`}
                onClick={onRefresh}
                disabled={isRefreshing}
            >
                <RefreshCcw size={16} className={`mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing' : 'Refresh'}
            </Button>
             {/* Timeframe Buttons - Use handleTimeframeChange */}
            <Button
              variant={selectedTimeFrameType === '7D' ? 'solid' : 'soft'} 
              color={selectedTimeFrameType === '7D' ? 'iris' : 'gray'}
              className="cursor-pointer"
              onClick={() => handleTimeframeChange('7D')}
            >
              7 days
            </Button>
            {/* ... other timeframe buttons ... */}
             <Button
               variant={selectedTimeFrameType === '1M' ? 'solid' : 'soft'}
               color={selectedTimeFrameType === '1M' ? 'iris' : 'gray'}
               className="cursor-pointer"
               onClick={() => handleTimeframeChange('1M')}
             >
               30 days
             </Button>
             <Button
               variant={selectedTimeFrameType === '3M' ? 'solid' : 'soft'}
               color={selectedTimeFrameType === '3M' ? 'iris' : 'gray'}
               className="cursor-pointer"
               onClick={() => handleTimeframeChange('3M')}
             >
               90 days
             </Button>
        </Flex>
        <Flex className="relative" gap="1">
            {/* Date Picker Buttons - Use startDate/endDate props & handleDateChange */}
             <Button
                variant={selectedTimeFrameType === 'CUSTOM' && !isStartDateCalendarOpen ? 'solid' : 'soft'}
                color={selectedTimeFrameType === 'CUSTOM' || isStartDateCalendarOpen ? 'iris' : 'gray'}
                className="min-w-[140px] cursor-pointer"
                onClick={() => setIsStartDateCalendarOpen(!isStartDateCalendarOpen)}
            >
                <CalendarIcon size={16} className="mr-1"/>
                {startDate ? format(startDate, 'MMM dd, yyyy') : 'Start date'}
            </Button>
             <Button
                variant={selectedTimeFrameType === 'CUSTOM' && !isEndDateCalendarOpen ? 'solid' : 'soft'}
                color={selectedTimeFrameType === 'CUSTOM' || isEndDateCalendarOpen ? 'iris' : 'gray'}
                className="min-w-[140px] cursor-pointer"
                onClick={() => setIsEndDateCalendarOpen(!isEndDateCalendarOpen)}
             >
                <CalendarIcon size={16} className="mr-1"/>
                {endDate ? format(endDate, 'MMM dd, yyyy') : 'End date'}
            </Button>
            {/* Date Picker Popovers - Use handleDateChange */}
             {isStartDateCalendarOpen && (
                <div className="absolute right-0 top-[100%] z-50 mt-1">
                <DatePicker
                    selected={startDate}
                    onChange={handleStartDateChange} // Use updated handler
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
                    onChange={handleEndDateChange} // Use updated handler
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
        </Flex>
        {/* All Tickets Button (unchanged) */}
        <Button variant="solid" color="iris" onClick={() => router.push('/all-tickets')}>
            All Tickets
        </Button>
      </div>
    </div>
  );
};

export default TopFilterBar; 