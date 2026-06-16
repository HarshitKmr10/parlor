import { useEffect, useState } from 'react';
import { nocApiInstance } from 'api/common/axiosInstance';


export interface IncidentUserLink {
  link: string;
  value: string;
}

export interface IncidentData {
  parent: string;
  made_sla: string;
  caused_by: string;
  watch_list: string;
  upon_reject: string;
  sys_updated_on: string;
  child_incidents: string;
  hold_reason: string;
  origin_table: string;
  task_effective_number: string;
  approval_history: string;
  skills: string;
  number: string;
  resolved_by: string;
  sys_updated_by: string;
  opened_by: IncidentUserLink;
  user_input: string;
  sys_created_on: string;
  sys_domain: IncidentUserLink;
  state: string;
  route_reason: string;
  sys_created_by: string;
  knowledge: string;
  order: string;
  calendar_stc: string;
  closed_at: string;
  cmdb_ci: string;
  delivery_plan: string;
  contract: string;
  impact: string;
  active: string;
  work_notes_list: string;
  business_service: string;
  business_impact: string;
  priority: string;
  sys_domain_path: string;
  rfc: string;
  time_worked: string;
  expected_start: string;
  opened_at: string;
  business_duration: string;
  group_list: string;
  work_end: string;
  caller_id: IncidentUserLink;
  reopened_time: string;
  resolved_at: string;
  approval_set: string;
  subcategory: string;
  work_notes: string;
  universal_request: string;
  short_description: string;
  close_code: string;
  correlation_display: string;
  delivery_task: string;
  work_start: string;
  assignment_group: string;
  additional_assignee_list: string;
  business_stc: string;
  cause: string;
  description: string;
  origin_id: string;
  calendar_duration: string;
  u_source: string;
  close_notes: string;
  notify: string;
  service_offering: string;
  sys_class_name: string;
  closed_by: string;
  follow_up: string;
  parent_incident: string;
  sys_id: string;
  contact_type: string;
  reopened_by: string;
  incident_state: string;
  urgency: string;
  problem_id: string;
  company: string;
  reassignment_count: string;
  activity_due: string;
  assigned_to: IncidentUserLink;
  severity: string;
  comments: string;
  approval: string;
  sla_due: string;
  comments_and_work_notes: string;
  due_date: string;
  sys_mod_count: string;
  reopen_count: string;
  sys_tags: string;
  escalation: string;
  upon_approval: string;
  correlation_id: string;
  location: string;
  category: string;
  url: string;
}

// API function
export async function getIncidentDetailsApi(
  incidentId: string,
): Promise<IncidentData> {
  return await nocApiInstance
    .get(`/api/v1/incident/${incidentId}`)
    .then((res) => res.data);
}

// Hook Params
interface UseIncidentDetailsParams {
  incidentId: string;
}

// Hook
export const useIncidentDetails = ({ incidentId }: UseIncidentDetailsParams) => {
  const [incidentDetails, setIncidentDetails] = useState<IncidentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await getIncidentDetailsApi(incidentId);
        setIncidentDetails(response ?? null);
      } catch (err: any) {
        console.error('Failed to fetch incident details:', err);
        setError(err?.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [incidentId]);

  return {
    incidentDetails,
    loading,
    error,
  };
};