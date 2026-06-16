"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  Search,
  ChevronDown,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  Button,
  TextField,
  Select,
  Table,
  Flex,
  Text,
  IconButton,
  Spinner,
} from "@radix-ui/themes";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useRouter } from "next/navigation";
import { useGlobalContext } from "../../../contexts/store";
import { useTicketCategories } from "../../../hooks/ticket-assist/useTicketCategories";
import { ApiTicket } from "../../../hooks/useCategoryDetailData";
import { format, parseISO, subDays } from "date-fns";
import { TimeFrameType } from "types/common";

// Mock Data for filter dropdowns
const mockFiltersData = {
  countryCodes: ["USA", "CAN", "MEX", "All"],
  roles: ["Agent", "Manager", "Admin", "All"],
  tenures: ["< 1 Year", "1-3 Years", "> 3 Years", "All"],
  contactTypes: ["Chat", "Email", "Phone", "All"],
};

interface DisplayableTicket extends ApiTicket {
  displayCreatedDate?: string;
}

const AllTicketsPage: React.FC = () => {
  const router = useRouter();
  const { user } = useGlobalContext();
  const org_id = user?.org_id;

  // --- Date State ---
  const [selectedTimeFrameType, setSelectedTimeFrameType] = useState<
    TimeFrameType
  >("1M"); // Default, can be '7D', '1M', '3M', 'CUSTOM'
  const initialStartDate = useMemo(() => subDays(new Date(), 30), []);
  const initialEndDate = useMemo(() => new Date(), []);

  const [startDate, setStartDate] = useState<Date | null>(initialStartDate);
  const [endDate, setEndDate] = useState<Date | null>(initialEndDate);
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  const [isEndDateCalendarOpen, setIsEndDateCalendarOpen] = useState(false);

  // --- End Date State ---

  const {
    allTicketsFromCategoryEndpoint,
    loading: ticketsLoading,
    error: ticketsError,
    refetch: refetchAllTickets,
  } = useTicketCategories(org_id, startDate, endDate); // Pass null for category to fetch all tickets

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState({
    countryCode: "All",
    role: "All",
    tenure: "All",
    contactType: "All",
  });

  const filteredAndSearchedTickets = useMemo(() => {
    let processedTickets: DisplayableTicket[] = allTicketsFromCategoryEndpoint.map(
      (ticket) => ({
        ...ticket,
        displayCreatedDate: ticket.created_at
          ? format(parseISO(ticket.created_at), "MM/dd/yyyy HH:mm")
          : "N/A",
      })
    );

    if (searchTerm) {
      processedTickets = processedTickets.filter(
        (ticket) =>
          ticket.short_description
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          ticket.number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    // Add other activeFilters logic here if needed
    return processedTickets;
  }, [allTicketsFromCategoryEndpoint, searchTerm, activeFilters]);

  const totalTickets = filteredAndSearchedTickets.length;
  const totalPages = Math.ceil(totalTickets / rowsPerPage);
  const paginatedTickets = useMemo(() => {
    return filteredAndSearchedTickets.slice(
      (currentPage - 1) * rowsPerPage,
      currentPage * rowsPerPage
    );
  }, [filteredAndSearchedTickets, currentPage, rowsPerPage]);

  const handleFilterChange = (filterName: string, value: string) => {
    setActiveFilters((prev) => ({ ...prev, [filterName]: value }));
    setCurrentPage(1);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(parseInt(value, 10));
    setCurrentPage(1);
  };

  // --- Date Handling Logic (similar to TopFilterBar) ---
  const handleIndividualStartDateChange = (date: Date | null) => {
    setStartDate(date);
    setSelectedTimeFrameType("CUSTOM");
    setIsStartDateCalendarOpen(false);
    setCurrentPage(1); // Reset page
  };

  const handleIndividualEndDateChange = (date: Date | null) => {
    setEndDate(date);
    setSelectedTimeFrameType("CUSTOM");
    setIsEndDateCalendarOpen(false);
    setCurrentPage(1); // Reset page
  };

  const handleTimeframeQuickChange = (type: "7D" | "1M" | "3M") => {
    const newEndDate = new Date();
    let newStartDate: Date;
    let timeFrameLabel: TimeFrameType;

    if (type === "7D") {
      newStartDate = subDays(newEndDate, 7);
      timeFrameLabel = "7D";
    } else if (type === "1M") {
      newStartDate = subDays(newEndDate, 30);
      timeFrameLabel = "1M";
    } else {
      // 3M
      newStartDate = subDays(newEndDate, 90);
      timeFrameLabel = "3M";
    }

    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setSelectedTimeFrameType(timeFrameLabel);
    setIsStartDateCalendarOpen(false); // Close calendars if open
    setIsEndDateCalendarOpen(false);
    setCurrentPage(1); // Reset page
  };
  // --- End Date Handling Logic ---

  useEffect(() => {
    if (org_id && startDate && endDate) {
      refetchAllTickets();
    }
  }, [startDate, endDate, org_id, refetchAllTickets]);

  if (!org_id) {
    return (
      <Flex justify="center" align="center" className="h-full">
        <Text>Organization not found.</Text>
      </Flex>
    );
  }

  return (
    <div className="p-6 bg-gray-100 h-full flex flex-col">
      <Flex align="center" mb="4" gap="2">
        <IconButton
          variant="ghost"
          color="gray"
          onClick={() => router.back()}
          className="cursor-pointer"
        >
          <ArrowLeft size={20} />
        </IconButton>
        <h1 className="text-xl font-semibold text-gray-800">All Tickets</h1>
      </Flex>

      {/* Date Filters - Styled like TopFilterBar */}
      <Flex
        mb="4"
        gap="3"
        align="center"
        justify="between"
        className="flex-wrap"
      >
        <Flex align="center" gap="2" className="flex-wrap">
          {" "}
          {/* Group for quick selects and custom dates */}
          {/* Timeframe Buttons */}
          <Button
            variant={selectedTimeFrameType === "7D" ? "solid" : "soft"}
            color={selectedTimeFrameType === "7D" ? "iris" : "gray"}
            className="cursor-pointer"
            onClick={() => handleTimeframeQuickChange("7D")}
          >
            7 days
          </Button>
          <Button
            variant={selectedTimeFrameType === "1M" ? "solid" : "soft"}
            color={selectedTimeFrameType === "1M" ? "iris" : "gray"}
            className="cursor-pointer"
            onClick={() => handleTimeframeQuickChange("1M")}
          >
            30 days
          </Button>
          <Button
            variant={selectedTimeFrameType === "3M" ? "solid" : "soft"}
            color={selectedTimeFrameType === "3M" ? "iris" : "gray"}
            className="cursor-pointer"
            onClick={() => handleTimeframeQuickChange("3M")}
          >
            90 days
          </Button>
          {/* Custom Date Picker Buttons */}
          <Flex className="relative" gap="2">
            <Button
              variant={
                selectedTimeFrameType === "CUSTOM" && !isStartDateCalendarOpen
                  ? "solid"
                  : "soft"
              }
              color={
                selectedTimeFrameType === "CUSTOM" || isStartDateCalendarOpen
                  ? "iris"
                  : "gray"
              }
              className="min-w-[140px] cursor-pointer"
              onClick={() =>
                setIsStartDateCalendarOpen(!isStartDateCalendarOpen)
              }
            >
              <CalendarIcon size={16} className="mr-1" />
              {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
            </Button>
            <Button
              variant={
                selectedTimeFrameType === "CUSTOM" && !isEndDateCalendarOpen
                  ? "solid"
                  : "soft"
              }
              color={
                selectedTimeFrameType === "CUSTOM" || isEndDateCalendarOpen
                  ? "iris"
                  : "gray"
              }
              className="min-w-[140px] cursor-pointer"
              onClick={() => setIsEndDateCalendarOpen(!isEndDateCalendarOpen)}
            >
              <CalendarIcon size={16} className="mr-1" />
              {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
            </Button>

            {/* Date Picker Popovers */}
            {isStartDateCalendarOpen && (
              <div className="absolute left-0 top-[100%] z-50 mt-1">
                {" "}
                {/* Adjusted to left-0 for start date */}
                <DatePicker
                  selected={startDate}
                  onChange={handleIndividualStartDateChange}
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
                {" "}
                {/* Kept right-0 for end date or adjust if needed */}
                <DatePicker
                  selected={endDate}
                  onChange={handleIndividualEndDateChange}
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
        </Flex>
        {/* You can add other filters (like the refresh button from TopFilterBar) here if needed */}
      </Flex>

      <Flex mb="4" gap="3" wrap="wrap">
        <TextField.Root
          placeholder="Search by ID or Title..."
          className="flex-grow min-w-[200px]"
          value={searchTerm}
          onChange={handleSearchChange}
        >
          <TextField.Slot>
            <Search height="16" width="16" />
          </TextField.Slot>
        </TextField.Root>
        <Select.Root
          value={activeFilters.contactType}
          onValueChange={(val) => handleFilterChange("contactType", val)}
          size="2"
        >
          <Select.Trigger placeholder="Contact Type" />
          <Select.Content>
            {mockFiltersData.contactTypes.map((ct) => (
              <Select.Item key={ct} value={ct}>
                {ct}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Flex>

      <div className="bg-white rounded-lg shadow overflow-hidden flex-grow">
        {ticketsLoading && (
          <Flex justify="center" align="center" p="4">
            <Spinner size="3" />
          </Flex>
        )}
        {ticketsError && (
          <Flex justify="center" align="center" p="4">
            <Text color="red">
              Error loading tickets: {ticketsError.message || "Unknown error"}
            </Text>
          </Flex>
        )}
        {!ticketsLoading && !ticketsError && (
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>TICKET ID</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>ISSUE TITLE</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>CALLER</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>CREATED DATE</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>DESCRIPTION</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {paginatedTickets.map((ticket: DisplayableTicket) => (
                <Table.Row key={ticket.caller_id || ticket.number}>
                  <Table.RowHeaderCell>
                    <Button
                      variant="ghost"
                      size="1"
                      color="iris"
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/ticket-details/${ticket.caller_id || ticket.number}`
                        )
                      }
                    >
                      {ticket.number}
                    </Button>
                  </Table.RowHeaderCell>
                  <Table.Cell>{ticket.short_description}</Table.Cell>
                  <Table.Cell>{ticket.caller_id}</Table.Cell>
                  <Table.Cell>{ticket.displayCreatedDate}</Table.Cell>
                  <Table.Cell>
                    {ticket.description || ticket.short_description}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="outline"
                      size="1"
                      color="gray"
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/ticket-details/${ticket.caller_id || ticket.number}`
                        )
                      }
                    >
                      View Details
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
              {paginatedTickets.length === 0 && !ticketsLoading && (
                <Table.Row>
                  <Table.Cell colSpan={6} align="center">
                    No tickets found matching your criteria.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        )}
      </div>

      <Flex
        align="center"
        justify="between"
        mt="4"
        className="text-sm text-gray-600 flex-shrink-0"
      >
        <Flex align="center" gap="2">
          <Text>Rows per page:</Text>
          <Select.Root
            value={rowsPerPage.toString()}
            onValueChange={handleRowsPerPageChange}
            size="1"
          >
            <Select.Trigger variant="soft" />
            <Select.Content>
              <Select.Item value="10">10</Select.Item>
              <Select.Item value="25">25</Select.Item>
              <Select.Item value="50">50</Select.Item>
            </Select.Content>
          </Select.Root>
          <Text>Total Tickets: {totalTickets}</Text>
        </Flex>
        <Flex align="center" gap="2">
          <Button
            variant="soft"
            color="gray"
            size="1"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || ticketsLoading}
          >
            Previous
          </Button>
          <Text>
            Page {currentPage} of {totalPages > 0 ? totalPages : 1}
          </Text>
          <Button
            variant="soft"
            color="gray"
            size="1"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={
              currentPage === totalPages || totalPages === 0 || ticketsLoading
            }
          >
            Next
          </Button>
        </Flex>
      </Flex>
    </div>
  );
};

export default AllTicketsPage;
