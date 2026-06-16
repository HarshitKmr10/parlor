'use client';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search, Clock, MessageSquare, FileWarning, Users, ChevronDown, CheckCircle } from 'lucide-react';
import { Button, TextField, Select, Table, Flex, Text, IconButton, Card, Badge, Link } from '@radix-ui/themes';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'; // For the donut chart

// Mock Data - Replace with actual data fetching based on issueTitle param
const mockIssueDetails = {
    ticketsCreated: 480,
    timeToResolution: '64hr',
    employeesReported: 313,
    employeeChats: 313,
    kbStatus: '2KB not found',
    avgTTR: '73.6 hr TTR', // This seems redundant with timeToResolution?
    resolvedPercent: 77,
    totalCases: 480, // Similar to ticketsCreated?
    activeCases: 140,
    closedCases: 340, 
    personaBreakdown: [
        { name: 'Engineering', color: '#8B5CF6' }, 
        { name: 'Customer Support', color: '#3B82F6' },
        { name: 'Accounting', color: '#2DD4BF' },
        { name: 'Operations', color: '#A3E635' },
        { name: 'Miscellaneous', color: '#6B7280' },
    ],
    incidents: Array.from({ length: 15 }, (_, i) => ({
        id: `INC32312${i}`,
        title: i % 4 === 0 ? "I'm having trouble logging into the EHR" : 
               i % 4 === 1 ? "Can't access my account" : 
               i % 4 === 2 ? "Need help unlocking account" : "User authentication error for account ID 98765",
        severity: i % 5 === 0 ? 'Critical-1' : 
                    i % 5 === 1 ? 'High-2' : 
                    i % 5 === 2 ? 'Medium-3' : 'Low-4',
        type: i % 3 === 0 ? 'Manage' : 'Troubleshoot', 
        createdOn: `11/${24 + i}/2024 10:46AM`, // Example date
        caller: ['Alex James', 'Beverly Smith', 'Carlos Hernandez', 'Diana Wong', 'Ethan Brown'][i % 5],
        ttrHr: [120, 7, 8, 14, 22, 30, 35, 42, 50, 60][i % 10],
        persona: ['Engineering', 'Customer Support', 'Accounting'][i % 3]
    })),
};

// Severity Badge Colors
const severityColors: { [key: string]: any } = {
    'Critical-1': 'red',
    'High-2': 'orange',
    'Medium-3': 'yellow',
    'Low-4': 'gray',
};

const IssueDetailPage: React.FC = () => {
    const router = useRouter();
    const params = useParams();
    // Decode the title from the URL parameter
    const issueTitle = decodeURIComponent(params.issueTitle as string || 'Unknown Issue');

    const [currentPage, setCurrentPage] = React.useState(1);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);

    // --- Data Fetching Placeholder ---
    // In a real app, you would fetch data based on issueTitle here
    const details = mockIssueDetails; 
    // --- End Data Fetching Placeholder ---

    // Pagination logic for incidents table
    const totalPages = Math.ceil(details.incidents.length / rowsPerPage);
    const paginatedIncidents = details.incidents.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    const handlePageChange = (page: number) => {
        if (page > 0 && page <= totalPages) {
        setCurrentPage(page);
        }
    };

    const handleRowsPerPageChange = (value: string) => {
        setRowsPerPage(parseInt(value, 10));
        setCurrentPage(1); // Reset to first page
    };

    // Data for the resolution donut chart
    const donutData = [
        { name: 'Resolved', value: details.resolvedPercent },
        { name: 'Remaining', value: 100 - details.resolvedPercent },
    ];
    const DONUT_COLORS = ['#6366F1', '#E5E7EB']; // Indigo-500, Gray-200

    return (
        <div className="p-6 bg-gray-100 h-full">
            {/* Header */}
            <Flex align="center" mb="4" gap="2">
                <IconButton variant="ghost" color="gray" onClick={() => router.back()} className="cursor-pointer">
                <ArrowLeft size={20} />
                </IconButton>
                <h1 className="text-xl font-semibold text-gray-800">{issueTitle}</h1>
            </Flex>

            {/* Summary Cards Row */}
            <Flex mb="4" gap="4" direction={{ initial: 'column', md: 'row'}}>
                {/* Left Summary Card */}
                <Card className="flex-grow">
                    <Text size="2" weight="medium" className="text-gray-600 mb-4 block">{issueTitle}</Text>
                    <Flex gap="6" align="center" mb="4">
                        <div>
                            <Text size="1" color="gray" className="block">Tickets Created</Text>
                            <Text size="5" weight="bold">{details.ticketsCreated}</Text>
                        </div>
                        <div>
                            <Text size="1" color="gray" className="block">Time To Resolution</Text>
                            <Text size="5" weight="bold">{details.timeToResolution}</Text>
                        </div>
                        <div>
                            <Text size="1" color="gray" className="block">No of Employees Reported</Text>
                            <Text size="5" weight="bold">{details.employeesReported}</Text>
                        </div>
                    </Flex>
                     <Flex gap="3" align="center" className="text-xs text-gray-500">
                         <Badge variant="soft" radius="full"><MessageSquare size={12} className="mr-1"/>{details.employeeChats} employee chats</Badge>
                         <Badge variant="soft" radius="full"><FileWarning size={12} className="mr-1"/>{details.kbStatus}</Badge>
                         <Badge variant="soft" radius="full"><Clock size={12} className="mr-1"/>{details.avgTTR}</Badge>
                     </Flex>
                </Card>

                 {/* Right Resolution Card (similar to dashboard one) */}
                 <Card className="w-full md:w-auto">
                     <Flex align="center" justify="between" gap="4">
                         {/* Donut Chart */}
                         <div className="relative w-20 h-20 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                data={donutData}
                                cx="50%"
                                cy="50%"
                                innerRadius="60%"
                                outerRadius="80%"
                                fill={DONUT_COLORS[0]}
                                paddingAngle={0}
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                                >
                                {donutData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} strokeWidth={0} />
                                ))}
                                </Pie>
                            </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-bold text-gray-800">{details.resolvedPercent}%</span>
                                <span className="text-xs text-gray-500">Resolved</span>
                            </div>
                        </div>
                        {/* Stats */}
                        <div className="flex-grow">
                            <p className="text-md font-semibold text-gray-700 mb-1">Total: {details.totalCases.toLocaleString()}</p>
                            <hr className="my-1"/>
                            <div className="flex items-center mt-1 space-x-2">
                                <div className="p-1 bg-indigo-100 rounded-full">
                                    <Users size={14} className="text-indigo-600" /> 
                                </div>
                                <span className="text-xs font-medium text-gray-800">{details.activeCases} Active</span>
                            </div>
                            <div className="flex items-center mt-1 space-x-2">
                                <div className="p-1 bg-green-100 rounded-full">
                                    <CheckCircle size={14} className="text-green-600" />
                                </div>
                            <span className="text-xs font-medium text-gray-800">{details.closedCases} Closed</span>
                            </div>
                        </div>
                        {/* Legend */}
                        <div className="flex items-center space-x-2 flex-shrink-0">
                            <div className="w-1.5 h-16 flex flex-col rounded overflow-hidden">
                                {details.personaBreakdown.map((item, index) => (
                                    <div key={item.name} style={{ backgroundColor: item.color, height: `${100 / details.personaBreakdown.length}%` }}></div>
                                ))}
                            </div>
                            <div className="space-y-0.5">
                                {details.personaBreakdown.map(item => (
                                    <div key={item.name} className="flex items-center">
                                        <span className="w-2 h-2 rounded-sm mr-1.5" style={{ backgroundColor: item.color }}></span>
                                        <span className="text-xs text-gray-600">{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Flex>
                 </Card>
            </Flex>

             {/* Filters */}
             <Flex mb="4" gap="3" wrap="wrap">
                <TextField.Root placeholder="Search Ticket" className="flex-grow min-w-[200px]">
                    <TextField.Slot>
                        <Search height="16" width="16" />
                    </TextField.Slot>
                </TextField.Root>
                {/* Add Filter Selects similar to AllTicketsPage */}
                <Select.Root defaultValue="USA" size="2">
                    <Select.Trigger placeholder="Country Code" />
                    <Select.Content>
                        {/* Options */} 
                    </Select.Content>
                </Select.Root>
                 <Select.Root defaultValue="Agent" size="2">
                    <Select.Trigger placeholder="Role" />
                    <Select.Content>
                         {/* Options */}
                    </Select.Content>
                </Select.Root>
                 <Select.Root defaultValue="< 1 Year" size="2">
                    <Select.Trigger placeholder="Tenure" />
                    <Select.Content>
                         {/* Options */}
                    </Select.Content>
                </Select.Root>
                 <Select.Root defaultValue="Chat" size="2">
                    <Select.Trigger placeholder="Contact type" />
                    <Select.Content>
                         {/* Options */}
                    </Select.Content>
                </Select.Root>
                <Select.Root defaultValue="Type1" size="2">
                    <Select.Trigger placeholder="Ticket Type" />
                    <Select.Content>
                         {/* Options */}
                    </Select.Content>
                </Select.Root>
            </Flex>

            {/* Incidents Table */}
            <div className="bg-white rounded-lg shadow overflow-x-auto"> {/* Added overflow-x-auto */}
                <Table.Root variant="surface" size="1">
                    <Table.Header>
                    <Table.Row>
                        <Table.ColumnHeaderCell>Incident ID</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Incident Title</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Severity</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Created on</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Caller Service/Name</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>TTR (hr)</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Persona</Table.ColumnHeaderCell>
                        {/* Add more headers if needed */}
                    </Table.Row>
                    </Table.Header>
                    <Table.Body>
                    {paginatedIncidents.map((incident) => (
                        <Table.Row key={incident.id}>
                        <Table.Cell>{incident.id}</Table.Cell>
                        <Table.RowHeaderCell>
                             {/* Use Link component for navigation */}
                            <Link href={`/ticket-details/${incident.id}`} className="text-indigo-600 hover:underline">
                                {incident.title}
                            </Link>
                        </Table.RowHeaderCell>
                        <Table.Cell>
                            <Badge color={severityColors[incident.severity] || 'gray'}>{incident.severity}</Badge>
                        </Table.Cell>
                        <Table.Cell>{incident.type}</Table.Cell>
                        <Table.Cell>{incident.createdOn}</Table.Cell>
                        <Table.Cell>
                             <Flex align="center" gap="2">
                                {/* Placeholder Avatar */} 
                                <div className="w-5 h-5 rounded-full bg-gray-300"></div>
                                <Text>{incident.caller}</Text>
                            </Flex>
                         </Table.Cell>
                         <Table.Cell>
                             <Flex align="center" gap="1">
                                 <Clock size={14} /> 
                                 {incident.ttrHr}
                             </Flex>
                         </Table.Cell>
                         <Table.Cell>{incident.persona}</Table.Cell>
                        </Table.Row>
                    ))}
                    </Table.Body>
                </Table.Root>
            </div>

             {/* Pagination */}
            <Flex align="center" justify="between" mt="4" className="text-sm text-gray-600">
                {/* Pagination controls similar to AllTicketsPage */}
                 <Flex align="center" gap="2">
                    <Text>Rows per page:</Text>
                    <Select.Root value={rowsPerPage.toString()} onValueChange={handleRowsPerPageChange} size="1">
                        <Select.Trigger variant="soft" />
                        <Select.Content>
                            <Select.Item value="10">10</Select.Item>
                            <Select.Item value="25">25</Select.Item>
                            <Select.Item value="50">50</Select.Item>
                        </Select.Content>
                    </Select.Root>
                </Flex>
                <Flex align="center" gap="2">
                    <Button variant="soft" color="gray" size="1" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                    Previous
                    </Button>
                    <Text>Page {currentPage} of {totalPages}</Text>
                    <Button variant="soft" color="gray" size="1" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                    Next
                    </Button>
                </Flex>
                <Flex align="center" gap="2">
                    <Text>Jump to page</Text>
                    <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
                </Flex>
            </Flex>
        </div>
    );
};

export default IssueDetailPage; 