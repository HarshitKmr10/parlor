'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { useGlobalContext } from '../../../contexts/store';
import { useTicketCategories } from '../../../hooks/ticket-assist/useTicketCategories';
import { useIssueTypeVolume } from '../../../hooks/ticket-assist/useIssueTypeVolume';
import { useTicketAssistMetrics } from '../../../hooks/ticket-assist/useTicketAssistMetrics';
import { useDailyBotUsage } from '../../../hooks/ticket-assist/useDailyBotUsage';
import useCategoryDetailData from '../../../hooks/useCategoryDetailData';
import { useIssuesPerEmployee } from '../../../hooks/ticket-assist/useIssuesPerEmployee';
import { useEmployeeDepartments } from '../../../hooks/ticket-assist/useEmployeeDepartments';
import useDepartmentDetailData from '../../../hooks/ticket-assist/useDepartmentDetailData';

import TopFilterBar, { 
    IssueCategory, 
    EmployeePersona 
} from '../../../components/TicketAssistDashboard/TopFilterBar';
import ResolutionRateCard from '../../../components/TicketAssistDashboard/ResolutionRateCard';
import IssuesPerEmployeeCard from '../../../components/TicketAssistDashboard/IssuesPerEmployeeCard';
import TimeToResolutionCard from '../../../components/TicketAssistDashboard/TimeToResolutionCard';
import FirstTouchResolutionCard from '../../../components/TicketAssistDashboard/FirstTouchResolutionCard';
import IssueTypeVolumeChart from '../../../components/TicketAssistDashboard/IssueTypeVolumeChart';
import IssueCategoriesVolumeChart from '../../../components/TicketAssistDashboard/IssueCategoriesVolumeChart';
import CvaAdaptationRateChart from '../../../components/TicketAssistDashboard/CvaAdaptationRateChart';
import CategoryDetailBoard from '../../../components/TicketAssistDashboard/CategoryDetailBoard';
import DepartmentDetailBoard from '../../../components/TicketAssistDashboard/DepartmentDetailBoard';
import TopicDetailSidebar, { TopicDetails } from '../../../components/TicketAssistDashboard/TopicDetailSidebar';

import { TimeFrameType } from 'types/common';
import { Box, Flex, Spinner } from '@radix-ui/themes';

// Helper to calculate TTR string from individual ticket (can be moved to a utils file)
const calculateTicketTtrString = (createdAt?: string, resolvedAt?: string | null): string => {
    if (!resolvedAt || !createdAt) {
        return 'N/A';
    }
    try {
        const start = parseISO(createdAt);
        const end = parseISO(resolvedAt);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 'N/A';
        
        const diffSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
        const hours = Math.floor(diffSeconds / 3600);
        // const minutes = Math.floor((diffSeconds % 3600) / 60);
        // return `${hours}h ${minutes}m`; // Or any other format
        return `${hours.toFixed(1)}hr`;
    } catch (e) {
        console.error("Error calculating TTR for sidebar ticket:", e);
        return 'N/A';
    }
};

const TicketAssistDashboardPage: React.FC = () => {
  const { user } = useGlobalContext();
  const org_id = user?.org_id;

  // --- State Management --- 
  // Date Range State - LIFTED
  const [startDate, setStartDate] = useState<Date | null>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [selectedTimeFrameType, setSelectedTimeFrameType] = useState<TimeFrameType>('7D');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter State
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory | null>(null);
  const [selectedEmployeePersona, setSelectedEmployeePersona] = useState<EmployeePersona | null>(null);

  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedTopicData, setSelectedTopicData] = useState<TopicDetails | null>(null);

  // --- Data Fetching (Get refetch functions) --- 
  const { categories, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useTicketCategories(org_id, startDate, endDate);
  const { employeePersonas, loading: employeePersonasLoading, error: employeePersonasError, refetch: refetchEmployeePersonas } = useEmployeeDepartments(org_id, startDate, endDate);
  const { data: issueTypeVolumeData, loading: issueTypeVolumeLoading, error: issueTypeVolumeError, refetch: refetchIssueTypeVolume } = useIssueTypeVolume(org_id, startDate, endDate);
  const { metrics, loading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useTicketAssistMetrics(org_id, startDate, endDate);
  const { data: dailyBotUsageData, loading: dailyBotUsageLoading, error: dailyBotUsageError, refetch: refetchDailyBotUsage } = useDailyBotUsage(org_id, startDate, endDate);
  const { data: issuesPerEmployeeData, loading: ipeLoading, error: ipeError, refetch: refetchIpe } = useIssuesPerEmployee(org_id, startDate, endDate);

  // --- Fetch data for Category Detail Board when a specific category is selected ---
  const { 
    processedData: categoryDetailProcessedData,
    rawTickets: categoryDetailRawTickets,
    loading: categoryDetailLoading, 
    error: categoryDetailError, 
    refetch: refetchCategoryDetail 
  } = useCategoryDetailData({ 
    categoryName: selectedCategory?.name === 'All Categories' ? null : selectedCategory?.name,
    org_id: org_id,
    startDate: startDate,
    endDate: endDate
  });

  // --- Fetch data for Department Detail Board when a specific department is selected ---
  const { 
    processedData: departmentDetailProcessedData,
    rawTickets: departmentDetailRawTickets,
    loading: departmentDetailLoading, 
    error: departmentDetailError, 
    refetch: refetchDepartmentDetail 
  } = useDepartmentDetailData({ 
    departmentName: selectedEmployeePersona?.name === 'All Employees' ? null : selectedEmployeePersona?.name,
    org_id: org_id,
    startDate: startDate,
    endDate: endDate
  });

  // Initialize selectedCategory directly if categories has a default "All"
  // Or keep it null and ensure loading state covers it.

  // This effect ensures that selectedCategory is set once categories are available.
  // It also handles the case where categories might update (e.g., due to date change and refetch).
  useEffect(() => {
    if (categories && categories.length > 0) {
      // If selectedCategory is null OR if the current selectedCategory's name isn't in the new categories list
      // OR if the issue count of the selectedCategory in the list is different from the current selectedCategory
      // then update selectedCategory to be the first item (usually "All Categories") from the new list.
      const currentSelectedStillValid = selectedCategory && categories.find(c => c.name === selectedCategory.name && c.issues === selectedCategory.issues);

      if (!currentSelectedStillValid) {
        setSelectedCategory(categories[0]); 
      }
    } else if (!categoriesLoading && categories.length === 0) {
      // Handle case where categories load but are empty (e.g., no data for date range)
      setSelectedCategory(null); // Or a default placeholder category
    }
  }, [categories, selectedCategory, categoriesLoading]); // Add categoriesLoading to dependencies

  // This effect ensures that selectedEmployeePersona is set once employeePersonas are available.
  useEffect(() => {
    if (employeePersonas && employeePersonas.length > 0) {
      const currentSelectedStillValid = selectedEmployeePersona && employeePersonas.find(p => p.name === selectedEmployeePersona.name && p.issues === selectedEmployeePersona.issues);

      if (!currentSelectedStillValid) {
        setSelectedEmployeePersona(employeePersonas[0]); 
      }
    } else if (!employeePersonasLoading && employeePersonas.length === 0) {
      setSelectedEmployeePersona(null);
    }
  }, [employeePersonas, selectedEmployeePersona, employeePersonasLoading]);

  // useEffect to log selectedTopicData when it changes
  useEffect(() => {
    if (selectedTopicData) {
      console.log("Updated Selected Topic Data (from useEffect):", selectedTopicData);
    }
  }, [selectedTopicData]); // This effect runs when selectedTopicData changes

  // --- Handlers --- 
  // Date Change Handlers - LIFTED 
  const handleDateChange = useCallback((start: Date | null, end: Date | null, type: TimeFrameType) => {
      setStartDate(start);
      setEndDate(end);
      setSelectedTimeFrameType(type);
       // Trigger data refresh based on new dates (implementation depends on hooks)
       console.log("Date changed:", start, end, type);
       // TODO: Potentially add a general refresh function call here
  }, []);

  // --- Update handleRefresh to call all refetch functions --- 
  const handleRefresh = useCallback(async () => {
    console.log("Refreshing all dashboard data...");
    setIsRefreshing(true); // Indicate refresh is starting
    try {
      // Call all refetch functions concurrently
      await Promise.all([
        refetchCategories(),
        refetchEmployeePersonas(),
        refetchIssueTypeVolume(),
        refetchMetrics(),
        refetchDailyBotUsage(),
        refetchIpe(),
        // Only refetch category details if a specific category is selected
        selectedCategory?.name !== 'All Categories' ? refetchCategoryDetail() : Promise.resolve(),
        // Only refetch department details if a specific department is selected
        selectedEmployeePersona?.name !== 'All Employees' ? refetchDepartmentDetail() : Promise.resolve(),
      ]);
      console.log("Dashboard data refreshed.");
    } catch (error) {
        // Optional: Add specific error handling/notification for refresh failure
        console.error("Error during dashboard refresh:", error);
    } finally {
        setIsRefreshing(false); // Indicate refresh is complete
    }
  }, [
      refetchCategories, 
      refetchEmployeePersonas,
      refetchIssueTypeVolume, 
      refetchMetrics, 
      refetchDailyBotUsage, 
      refetchIpe,
      refetchCategoryDetail, 
      selectedCategory // Need selectedCategory to decide whether to refresh detail data
    ]);

  // Category Selection Handler
  const handleSelectCategory = (category: IssueCategory) => {
      setSelectedCategory(category);
      setIsSidebarOpen(false); 
      setSelectedTopicData(null);
  };

  // Employee Persona Selection Handler
  const handleSelectEmployeePersona = (persona: EmployeePersona) => {
      setSelectedEmployeePersona(persona);
      setIsSidebarOpen(false);
      setSelectedTopicData(null);
  };

  // Sidebar Handlers
  const handleCardClick = (cardData: any) => {
     const currentCategoryName = selectedCategory ? selectedCategory.name : 'Unknown Category';
     const topicDisplayName = `${cardData.columnTitle} ${currentCategoryName}`; 

     let realPeriodInfo = `Data for ${cardData.platform}`;
     let realIssuesPerEmployeeValue = 0;
     let realTtrValue = { value: 0, unit: 'hr' };
     let realTopicExamples: string[] = [];
     let realTicketsWithoutKbs: TopicDetails['ticketsWithoutKbs'] = [];
     
     // Use either category or department tickets based on what's currently selected
     const allTicketsForSelected = selectedCategory.name !== 'All Categories' 
       ? (categoryDetailRawTickets || [])
       : (departmentDetailRawTickets || []);

     if (allTicketsForSelected.length > 0) {
         const platformTickets = allTicketsForSelected.filter(ticket => {
             const platformMatches = (ticket?.short_description || ticket?.description || 'Unknown Topic') === cardData?.platform;
             const typeMatches = (ticket?.type_1?.charAt(0)?.toUpperCase() + ticket?.type_1?.slice(1)) === cardData?.columnTitle;
             
             return platformMatches && typeMatches;
         });


         if (platformTickets.length > 0) {
             const uniqueCallers = new Set(platformTickets.map(t => t.caller_id));
             const employeeCountForPlatform = uniqueCallers.size;
             const issueCountForPlatform = platformTickets.length;

             realPeriodInfo = `${employeeCountForPlatform} employee(s) raised ${issueCountForPlatform} issue(s) for ${cardData.platform} in this period.`;
             
             if (employeeCountForPlatform > 0) {
                 realIssuesPerEmployeeValue = parseFloat((issueCountForPlatform / employeeCountForPlatform).toFixed(1));
             }

             let totalTtrMilliseconds = 0;
             let resolvedCount = 0;
             platformTickets.forEach(t => {
                 if (t.resolved_at && t.created_at) {
                     try {
                        const start = parseISO(t.created_at).getTime();
                        const end = parseISO(t.resolved_at).getTime();
                        if (!isNaN(start) && !isNaN(end) && end > start) {
                            totalTtrMilliseconds += (end - start);
                            resolvedCount++;
                        }
                     } catch (e) { /* ignore date parsing errors for this calculation */ }
                 }
             });
             if (resolvedCount > 0) {
                 const avgTtrHours = (totalTtrMilliseconds / resolvedCount / (1000 * 60 * 60));
                 realTtrValue = { value: parseFloat(avgTtrHours.toFixed(1)), unit: 'hr' };
             } else if (cardData.timeToResolution && typeof cardData.timeToResolution === 'string') {
                 const ttrMatch = cardData.timeToResolution.match(/([\d.]+)\s*hr/i);
                 if (ttrMatch && ttrMatch[1]) {
                     realTtrValue = { value: parseFloat(ttrMatch[1]), unit: 'hr'};
                 }
             }

             realTopicExamples = platformTickets.slice(0, 5).map(t => t.short_description);
             
             realTicketsWithoutKbs = platformTickets
                 .filter(t => t.knowledge === 'false')
                 .slice(0, 3) 
                 .map(t => ({
                     id: t.number,
                     title: t.short_description,
                     ttr: calculateTicketTtrString(t.created_at, t.resolved_at),
                     agent: t.assigned_to || "N/A"
                 }));
         }
     }

     const sidebarData: TopicDetails = {
          topicName: topicDisplayName,
          periodInfo: realPeriodInfo,
          issuesPerEmployee: { 
              value: realIssuesPerEmployeeValue, 
              change: 0
          },
          timeToResolution: { 
              ...realTtrValue, 
              change:  0
          },
          firstTouchResolution: { 
              value: 0,
              change: 0 
          },
          selectedTopic: {
              name: cardData.platform,
              issueCount: cardData.issueCount, 
              employeeCount: cardData.employeeCount, 
              ttr: cardData.timeToResolution 
          },
          topicExamples: realTopicExamples,
          ticketsWithoutKbs: realTicketsWithoutKbs,
      };

     setSelectedTopicData(sidebarData);
     setIsSidebarOpen(true);
   };

  const handleCloseSidebar = () => {
      setIsSidebarOpen(false);
      setSelectedTopicData(null);
  };

  const handleHome = useCallback(() => {
      setSelectedCategory(null);
      setSelectedEmployeePersona(null);
  }, []);

  // --- Rendering --- 
  // Revised Loading Condition:
  // Wait for categories to load AND for selectedCategory to be set (which depends on categories).
  // Also wait for employeePersonasLoading and selectedEmployeePersona to be set.
  const isLoading = categoriesLoading || !selectedCategory || employeePersonasLoading || !selectedEmployeePersona;

  if (isLoading) { 
    return (
      <Flex
        align="center"
        justify="center"
        style={{ 
          width: '100%', 
          minHeight: 'calc(100vh - 120px)',
          display: 'flex' 
        }} 
      >
        <Spinner size="3" />
      </Flex>
    );
  }

  // Handle category fetch error
  if (categoriesError) {
      // TODO: Add a proper error display component
      return <div>Error loading categories. Please try refreshing.</div>;
  }

  // Handle other data fetching errors
  if (issueTypeVolumeError) {
      // TODO: Add a proper error display component
      return <div>Error loading issue type volume data. Please try refreshing.</div>;
  }
  if (metricsError) {
      // TODO: Add a proper error display component
      return <div>Error loading dashboard metrics. Please try refreshing.</div>;
  }
  if (dailyBotUsageError) {
      // TODO: Add a proper error display component
      return <div>Error loading daily bot usage data. Please try refreshing.</div>;
  }
  if (ipeError) {
      // TODO: Add a proper error display component for IPE error
      return <div>Error loading issues per employee data. Please try refreshing.</div>;
  }
  if (employeePersonasError) {
      // TODO: Add a proper error display component for employee personas error
      return <div>Error loading employee departments data. Please try refreshing.</div>;
  }

  return (
    <div className="relative p-6 bg-gray-100 h-screen overflow-y-auto">
      <Box className='cursor-pointer' onClick={handleHome}>
        <h1 className="text-2xl font-semibold text-gray-800 mb-4">Ticket Assist</h1>
      </Box>

      {/* Pass all necessary props to TopFilterBar */}
      <TopFilterBar 
        categories={categories} 
        selectedCategory={selectedCategory} 
        onSelectCategory={handleSelectCategory}
        employeePersonas={employeePersonas}
        selectedEmployeePersona={selectedEmployeePersona}
        onSelectEmployeePersona={handleSelectEmployeePersona}
        startDate={startDate}
        endDate={endDate}
        selectedTimeFrameType={selectedTimeFrameType}
        onDateChange={handleDateChange} 
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {selectedCategory.name === 'All Categories' && selectedEmployeePersona.name === 'All Employees' ? (
        <>
          {/* Pass fetched data to dashboard cards & charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Update cards with props */}
            <ResolutionRateCard 
                value={metrics?.resolutionRate} 
                change={metrics?.weeklyChange} 
                loading={metricsLoading} 
            />
            <IssuesPerEmployeeCard 
                value={issuesPerEmployeeData?.value} 
                change={issuesPerEmployeeData?.change}
                loading={ipeLoading} 
            /> 
            <TimeToResolutionCard 
                value={metrics?.meanTimeToResolve} 
                change={metrics?.weeklyChange} 
                loading={metricsLoading} 
            />
            <FirstTouchResolutionCard 
                value={metrics?.firstTouchResolutionRate}
                change={metrics?.weeklyChange} 
                loading={metricsLoading} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Update charts with props */}
            <IssueTypeVolumeChart data={issueTypeVolumeData} loading={issueTypeVolumeLoading} />
            <IssueCategoriesVolumeChart data={categories} loading={categoriesLoading} />
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Update chart with props */}
            <CvaAdaptationRateChart data={dailyBotUsageData} loading={dailyBotUsageLoading}/>
          </div>
        </>
      ) : selectedCategory.name !== 'All Categories' ? (
        <CategoryDetailBoard 
            categoryName={selectedCategory.name} 
            onCardClick={handleCardClick} 
            data={categoryDetailProcessedData}
            loading={categoryDetailLoading}
            error={categoryDetailError}
        />
      ) : (
        <DepartmentDetailBoard 
            departmentName={selectedEmployeePersona.name} 
            onCardClick={handleCardClick} 
            data={departmentDetailProcessedData}
            loading={departmentDetailLoading}
            error={departmentDetailError}
        />
      )}

      {/* Render Sidebar (unchanged for now) */}
       <TopicDetailSidebar 
         isOpen={isSidebarOpen}
         onClose={handleCloseSidebar}
         topicDetails={selectedTopicData} 
       />

    </div>
  );
};

export default TicketAssistDashboardPage;


