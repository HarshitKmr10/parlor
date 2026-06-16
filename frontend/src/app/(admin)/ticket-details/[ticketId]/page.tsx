// new-frontend/src/app/(admin)/ticket-details/[ticketId]/page.tsx
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Clock, BookOpen, MapPin, Briefcase, Building, Bot } from 'lucide-react';
import { Button, Flex, Text, IconButton, Card, Badge, Tabs, Box, Link, Grid, Spinner } from '@radix-ui/themes';
import { useGlobalContext } from '../../../../contexts/store';
import { useTicketCategories } from '../../../../hooks/ticket-assist/useTicketCategories';
import { ApiTicket as FetchedApiTicket } from '../../../../hooks/useCategoryDetailData'; // Renaming to avoid conflict
import { subDays, format, parseISO } from 'date-fns';

// Define the structure for the detailed ticket page
interface TicketDetailsData extends FetchedApiTicket { // Extend the base ticket type
    incidentId: string; // To be consistently populated
    title: string; // To be consistently populated
    // --- Fields from mock that need careful mapping or separate API calls ---
    employee?: {
        name: string;
        avatarUrl?: string;
        location?: string; // Potentially from `location` field if available on caller
        businessUnit?: string; // Likely requires separate data source or parsing
        department?: string; // Likely requires separate data source or parsing
        parentBusinessUnit?: string; // Likely requires separate data source or parsing
    };
    executiveSummary?: string[]; // Will try to derive from `description` or `comments`
    actionsTaken?: { // This is very specific, likely not in the list view
        text: string;
        links?: { text: string; href: string }[];
    };
    timeline?: { label: string; time: string; date: string; duration: string | null }[]; // Will create a basic one
    chatHistories?: { // This is very specific, likely not in the list view
        type: string; 
        title: string; 
        timestamp: string; 
        summary: string; 
        content: string[] 
    }[];
    // --- Add other specific fields from mockTicketDetails if they can be mapped ---
    ttr_display?: string; // For displaying TTR if available
    issuesResolved_display?: number; // For displaying resolved issues if available
}

const severityColors: { [key: string]: any } = {
    '1 - Critical': 'red',
    'Critical': 'red',
    '2 - High': 'orange',
    'High': 'orange',
    '3 - Moderate': 'yellow',
    '3 - Low': 'gray', // From JSON sample: "severity": "3 - Low"
    'Moderate': 'yellow',
    '4 - Low': 'gray',
    'Low': 'gray',
};

// Helper to parse severity from strings like "3 - Low"
const parseSeverity = (severityString: string | undefined | null): string => {
    if (!severityString) return 'Low';
    if (severityString.includes('Critical')) return 'Critical';
    if (severityString.includes('High')) return 'High';
    if (severityString.includes('Moderate')) return 'Moderate';
    if (severityString.includes('Low')) return 'Low';
    return severityString; // Fallback
};


const TicketDetailPage: React.FC = () => {
    const router = useRouter();
    const params = useParams();
    // Decode the ticketId from URL (e.g., "Event%20Management" becomes "Event Management")
    const decodedTicketIdFromUrl = useMemo(() => {
        if (params.ticketId && typeof params.ticketId === 'string') {
            try {
                return decodeURIComponent(params.ticketId);
            } catch (e) {
                console.error("Error decoding ticketId:", e);
                return params.ticketId; // Fallback to original if decoding fails
            }
        }
        return '';
    }, [params.ticketId]);


    const { user } = useGlobalContext();
    const org_id = user?.org_id;

    const [startDate, setStartDate] = useState<Date | null>(subDays(new Date(), 90));
    const [endDate, setEndDate] = useState<Date | null>(new Date());

    const { 
        allTicketsFromCategoryEndpoint, 
        loading: ticketsLoading, 
        error: ticketsError 
    } = useTicketCategories(org_id, startDate, endDate);

    const [ticketDetails, setTicketDetails] = useState<TicketDetailsData | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(true);
    const [errorDetails, setErrorDetails] = useState<string | null>(null);
    const [hasRedirected, setHasRedirected] = useState(false);

    useEffect(() => {
        if (hasRedirected) return;

        if (!decodedTicketIdFromUrl) {
            setErrorDetails("Ticket ID is missing from URL.");
            setIsLoadingDetails(false);
            return;
        }

        if (ticketsLoading) {
            setIsLoadingDetails(true);
            return;
        }

        if (ticketsError) {
            setErrorDetails(ticketsError.message || "Error fetching ticket list.");
            setIsLoadingDetails(false);
            return;
        }

        if (allTicketsFromCategoryEndpoint.length > 0) {
            const foundTicket = allTicketsFromCategoryEndpoint.find(ticket => {
                // Ensure properties exist on ticket before trimming
                const callerIdMatch = ticket.caller_id && ticket.caller_id.trim() === decodedTicketIdFromUrl;
                const uReportingCustomerMatch = (ticket as any).u_reporting_customer && (ticket as any).u_reporting_customer.trim() === decodedTicketIdFromUrl;
                
                return ticket.number === decodedTicketIdFromUrl ||
                       (ticket as any).sys_id === decodedTicketIdFromUrl || // Use type assertion if sys_id is not in FetchedApiTicket type but present in data
                       callerIdMatch ||
                       uReportingCustomerMatch ||
                       ticket.short_description === decodedTicketIdFromUrl;
            });

            if (foundTicket) {
                const actualIncidentNumber = foundTicket.number;

                // Check if URL needs to be updated to the actual incident number
                if (actualIncidentNumber && actualIncidentNumber !== decodedTicketIdFromUrl && !hasRedirected) {
                    setHasRedirected(true);
                    router.replace(`/ticket-details/${encodeURIComponent(actualIncidentNumber)}`, { scroll: false });
                    return;
                }
                
                const details: TicketDetailsData = {
                    ...(foundTicket as any), // Use type assertion here too if spreading fields not in defined type
                    incidentId: actualIncidentNumber || (foundTicket as any).sys_id || decodedTicketIdFromUrl,
                    title: foundTicket.short_description || "No title available",
                    
                    employee: {
                        name: foundTicket.caller_id?.trim() || (foundTicket as any).opened_by?.trim() || "Unknown User",
                        avatarUrl: "/placeholder-avatar.png",
                        location: (foundTicket as any).location || "N/A", 
                        businessUnit: "N/A", 
                        department: (foundTicket as any).assignment_group || "N/A", 
                        parentBusinessUnit: "N/A",
                    },

                    severity: parseSeverity((foundTicket as any).priority || (foundTicket as any).severity),
                    
                    executiveSummary: foundTicket.description ? 
                        [foundTicket.description] : 
                        ((foundTicket as any).comments?.substring(0, 500) + "..." || "No detailed summary available."),

                    actionsTaken: {
                        text: (foundTicket as any).work_notes?.split('\n\n')[0] || "Actions logged in work notes.",
                        links: [],
                    },

                    timeline: [
                        { label: "Ticket Created", time: foundTicket.created_at ? format(parseISO(foundTicket.created_at), 'HH:mm') : 'N/A', date: foundTicket.created_at ? format(parseISO(foundTicket.created_at), 'MMM dd, yy') : 'N/A', duration: null },
                        ...((foundTicket as any).updated_at && (foundTicket as any).updated_at !== foundTicket.created_at ? [{ label: "Last Updated", time: format(parseISO((foundTicket as any).updated_at), 'HH:mm') , date: format(parseISO((foundTicket as any).updated_at), 'MMM dd, yy'), duration: null }] : []),
                        ...(foundTicket.resolved_at ? [{ label: "Resolved", time: format(parseISO(foundTicket.resolved_at), 'HH:mm') , date: format(parseISO(foundTicket.resolved_at), 'MMM dd, yy'), duration: null }] : []),
                    ],
                    
                    chatHistories: [],
                };
                setTicketDetails(details);
                setErrorDetails(null);
            } else {
                setErrorDetails(`Ticket with ID "${decodedTicketIdFromUrl}" not found in the current date range or with matching fields.`);
            }
        } else if (!ticketsLoading) {
            setErrorDetails("No tickets available in the list to search from. Check date range or if the list is empty.");
        }
        setIsLoadingDetails(false);

    }, [decodedTicketIdFromUrl, allTicketsFromCategoryEndpoint, ticketsLoading, ticketsError, org_id, router, hasRedirected]);

    // ... (rest of the component: loading, error, and rendering logic)
    // Ensure the rendering logic below uses `ticketDetails` and accesses fields safely (e.g., ticketDetails?.employee?.name)

    if (isLoadingDetails || (!ticketDetails && !errorDetails && !ticketsLoading && !hasRedirected) ) {
        // ... same loading UI ...
        return (
            <Flex justify="center" align="center" className="h-full p-6">
                <Spinner size="3" />
                <Text ml="2">{!org_id ? "Organization ID not found..." : "Loading ticket details..."}</Text>
            </Flex>
        );
    }

    if (errorDetails) {
        // ... same error UI ...
        return (
            <div className="p-6 bg-gray-100 h-full">
                 <Flex align="center" mb="4" gap="2">
                    <IconButton variant="ghost" color="gray" onClick={() => router.back()} className="cursor-pointer">
                        <ArrowLeft size={20} />
                    </IconButton>
                    <h1 className="text-xl font-semibold text-gray-800">Ticket Details Error</h1>
                </Flex>
                <Card>
                    <Text color="red" className="block text-center">{errorDetails}</Text>
                </Card>
            </div>
        );
    }

    if (!ticketDetails) {
        // ... same not found UI ...
         return (
            <div className="p-6 bg-gray-100 h-full">
                 <Flex align="center" mb="4" gap="2">
                    <IconButton variant="ghost" color="gray" onClick={() => router.back()} className="cursor-pointer">
                        <ArrowLeft size={20} />
                    </IconButton>
                    <h1 className="text-xl font-semibold text-gray-800">Ticket Not Found</h1>
                </Flex>
                <Card>
                    <Text className="block text-center">Ticket details for ID "{decodedTicketIdFromUrl}" could not be loaded or found.</Text>
                </Card>
            </div>
        );
    }
    
    const details = ticketDetails; // Use the fetched and mapped details

    return (
        <div className="p-6 bg-gray-100 h-full overflow-y-auto">
            <Flex align="center" mb="4" gap="2">
                <IconButton variant="ghost" color="gray" onClick={() => router.back()} className="cursor-pointer">
                    <ArrowLeft size={20} />
                </IconButton>
                <h1 className="text-xl font-semibold text-gray-800">Ticket Details & Resolution - {details.incidentId}</h1>
            </Flex>

            <Card>
                 <Flex direction={{ initial: 'column', md: 'row'}} justify="between" mb="4">
                    <Box mb={{ initial: '4', md: '0'}}>
                        <Text size="2" color="gray" className="block mb-1">{details.incidentId}</Text>
                        <h2 className="text-lg font-semibold text-gray-800 mb-2">{details.title}</h2>
                        <Flex gap="2" align="center">
                            <Badge 
                                color={severityColors[(details as any).priority || 'Low'] || 'gray'} 
                                variant="solid"
                            >
                                {(details as any).priority || 'Low'}
                            </Badge>
                            {/* TTR and Issues Resolved need to be sourced from your API data if available */}
                            {/* Example: <Badge color="gray" variant="soft"><Clock size={12} className="inline mr-1" /> {details.ttr_display || 'N/A'}</Badge> */}
                            {/* Example: <Badge color="gray" variant="soft"><BookOpen size={12} className="inline mr-1" /> {details.issuesResolved_display || 0} Issues Resolved</Badge> */}
                             
                             <Badge color="gray" variant="soft">
                                <Clock size={12} className="inline mr-1" /> 
                                {(details as any).sla_due && (details as any).sla_due !== "UNKNOWN" ? `SLA Due: ${(details as any).sla_due}` : ((details as any).business_duration || "TTR N/A")}
                            </Badge>
                             <Badge color="gray" variant="soft">
                                <BookOpen size={12} className="inline mr-1" /> 
                                {(details as any).state || "State N/A"} 
                            </Badge>
                        </Flex>
                    </Box>
                    {details.employee && (
                    <Card variant="surface" size="1" className="w-full md:max-w-xs">
                         <Text size="2" weight="medium" className="mb-2 block">Employee Details</Text>
                         <Flex gap="3" align="center" mb="2">
                                <img src={details.employee.avatarUrl || "/placeholder-avatar.png"} alt={details.employee.name} className="w-8 h-8 rounded-full bg-gray-300" />
                            <Box>
                                <Text size="2" weight="medium">{details.employee.name}</Text>
                                    {!!details.employee.location && details.employee.location !== "N/A" && (
                                <Flex align="center" gap="1" className="text-xs text-gray-500">
                                    <MapPin size={12} /> {details.employee.location}
                                </Flex>
                                    )}
                            </Box>
                         </Flex>
                         <Flex direction="column" className="text-xs text-gray-600 space-y-0.5">
                                 {!!details.employee.businessUnit && details.employee.businessUnit !== "N/A" && <Flex gap="1"><Briefcase size={12} /> Business unit : <Text weight="medium">{details.employee.businessUnit}</Text></Flex>}
                                 {!!details.employee.department && details.employee.department !== "N/A" && <Flex gap="1"><Building size={12} /> Department : <Text weight="medium">{details.employee.department}</Text></Flex>}
                                 
                         </Flex>
                    </Card>
                    )}
                </Flex>

                <Tabs.Root defaultValue="description">
                    <Tabs.List>
                        <Tabs.Trigger value="description">Description & Details</Tabs.Trigger>
                        <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
                        <Tabs.Trigger value="comments">Comments & Worknotes</Tabs.Trigger>
                    </Tabs.List>

                    <Box pt="3">
                        <Tabs.Content value="description">
                            <Text size="3" weight="medium" className="block mb-2">Full Description</Text>
                            <div className="space-y-2 text-sm text-gray-700 mb-4 prose prose-sm max-w-none">
                                <p>{details.description || "No full description available."}</p>
                            </div>

                            {details.executiveSummary && details.executiveSummary.length > 0 && details.executiveSummary[0] !== (details.description) && (
                                <>
                                    <Text size="3" weight="medium" className="block mb-2 mt-4">Summary / Work Notes Snippet</Text>
                                    <div className="space-y-2 text-sm text-gray-700 mb-4 prose prose-sm max-w-none">
                                        {details.executiveSummary.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                                    </div>
                                </>
                            )}

                            {details.actionsTaken && !!details.actionsTaken.text && (
                                <>
                                    <Text size="3" weight="medium" className="block mb-2 mt-4">Initial Actions / Notes</Text>
                             <Flex align="center" gap="2" className="text-sm text-gray-700 mb-4">
                                <span>{details.actionsTaken.text}</span>
                                        {details.actionsTaken.links?.map(link => (
                                             <Link key={link.text} href={link.href || '#'} size="1">{link.text}</Link>
                                ))}
                            </Flex>
                                </>
                            )}
                            

                        </Tabs.Content>
                        
                        <Tabs.Content value="timeline">
                            {details.timeline && details.timeline.length > 0 ? (
                                <>
                                <Text size="3" weight="medium" className="block mb-3">Key Events</Text>
                                 <Grid columns={`${Math.min(details.timeline.length, 5)}`} gap="3" className="text-center mb-6">
                                    {details.timeline.map((item, index) => (
                                         <Box key={index} p="2" className="border rounded bg-slate-50">
                                         <Text size="1" color="gray" className="block mb-0.5">{item.label}</Text>
                                         <Text size="2" weight="medium" className="block">{item.time}</Text>
                                         <Text size="1" color="gray" className="block mb-1">{item.date}</Text>
                                         {!!item.duration && 
                                             <Badge color="indigo" variant="soft" radius="full" size="1">{item.duration}</Badge>
                                         }
                                     </Box>
                                ))}
                            </Grid>
                                </>
                            ) : <Text>No timeline data available.</Text>}
                        </Tabs.Content>

                        
                    </Box>
                </Tabs.Root>
            </Card>
        </div>
    );
};

export default TicketDetailPage; 