import { Dictionary } from '@fullcalendar/core/internal';

export interface PerformanceDataPoint {
  x: number;
  y: number;
}

export interface HardwareMetric {
  hardwareName: string;
  performanceMetric: string;
  // growth: string;
  // data: PerformanceDataPoint[];
}

export interface Ticket {
  taskTitle: string;
  taskNumber: string;
  employeeLink?: string;
  ticketLink?: string;
  createdOn: string;
  responseDue?: string;
  taskCreator?: string;
  taskStatus?: string; // Optional field, e.g., 'Open', 'Closed'
  description?: string;
  taskCategory?: string; // Optional field, e.g., 'inquiry', 'hardware'
  taskPriority?: string; // Optional field, e.g., '1', '2', '3'
  taskUrgency?: string; // Optional field, e.g., '1', '2', '3'
  taskImpact?: string; // Optional field, e.g., '1', '2', '3'
}

// Type for tickets from get-oncall-tickets endpoint
export interface OnCallTicket {
  ticket_id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: string;
  resolver_group: {
    link: string;
    value: string;
  };
  priority: number;
  urgency: number;
  work_notes: string;
  update_type: string;
  confidence_score: number;
  reasoning: string;
  related_to_vva: boolean;
  ticket_display_info: {
    short_description: string;
    category: string;
    channel: string;
    state: string;
    impact: number;
    urgency: number;
    priority: number;
    assigned_to: string;
    assignment_group: {
      link: string;
      value: string;
    };
  };
}
export interface EmployeeDetailsProps {
  hasEmployeeId: boolean;
  employeeId?: string;
  employeeName?: string;
  phoneNumber?: string;
  email?: string;
  hardwareMetrics?: Dictionary;
  isUserDetailsLoading?: boolean;
  isDeviceDetailsLoading?: boolean;
  endpointManagementEnabled?: boolean | string;
  tickets?: Ticket[];
  isTicketLoading?: boolean;
  useUserId?: boolean;
}

export interface HardwareMetricFormatted {
  // hardwareName: 'Device Name' |
  // 'Operating System' | 'Device Type'
  // | 'User Display Name' | 'Last Sync Time' | 'Free Storage Space';
  hardwareName: string;
  performanceMetric: number;
}
