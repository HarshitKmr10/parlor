import { serviceDeskInstance } from 'api/common/axiosInstance';
import { P1Meeting, TeamPermissionsType, TeamType } from 'types/common';
import { UserType } from 'types/userTypes';

type IntakeMeetings = {
  id: number;
  meeting_id: string;
  created_at: string;
  created_by: string;
  team_id: string;
};

type P1IntakeMeetings = {
  id: number;
  meeting_id: string;
  created_at: string;
  created_by: string;
  team_id: string;
  incident_name: string;
};

type Team = {
  id: string;
  created_at: string;
  name: string;
  logo: string;
  description: string;
  org_id: string;
  created_by: string;
};

// Helper function to get access control configuration
const getAccessControlConfig = async (orgId: string): Promise<{ restrict_meeting_access_to_admin: boolean }> => {
  try {
    const response = await serviceDeskInstance.get(`/service_desk/access_control_config/${orgId}`);
    return response.data;
  } catch (err) {
    console.error('Error fetching access control config, defaulting to restricted access:', err);
    // Default to restricted access if there's an error
    return { restrict_meeting_access_to_admin: true };
  }
};

export const Teams = {
  GetAllMeetings: async (
    user: UserType,
    selectedTeam: TeamType,
  ): Promise<IntakeMeetings[]> => {
    try {
      const res = await serviceDeskInstance.get(
        `/service_desk/${selectedTeam?.id}/get_all_intake_meetings`
      );

      const data = (await res.data) as IntakeMeetings[];

      return data;
    } catch (err) {
      console.error('There was an error fetching meetings');
    }
  },

  GetAllMeetingsPaginated: async (
    user: UserType,
    selectedTeam: TeamType,
    limit = 10,
    cursor?: string,
    sortField = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<{
    data: any[];
    pagination: {
      has_more: boolean;
      next_cursor: string | null;
      current_page_size: number;
      sort_field: string;
      sort_order: string;
    };
  }> => {
    try {
      let url = `/service_desk/${selectedTeam?.id}/get_all_meetings_by_teamid_paginated?limit=${limit}&sort_field=${sortField}&sort_order=${sortOrder}`;
      
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }

      const res = await serviceDeskInstance.get(url);

      return res.data;
    } catch (err) {
      console.error('There was an error fetching meetings:', err);
      throw err;
    }
  },
  GetAllKnowledgeTransitionMeetings: async (
    user: UserType,
    selectedTeam: TeamType,
  ): Promise<IntakeMeetings[]> => {
    try {
      const res = await serviceDeskInstance.get(
        `/service_desk/${selectedTeam?.id}/get_all_knowledge_transition_meetings_details`
      );

      const data = (await res.data) as IntakeMeetings[];

      return data;
    } catch (err) {
      console.error('There was an error fetching meetings');
    }
  },

  // Optimized method that fetches both meeting IDs and full meeting details in one call
  GetAllKnowledgeTransitionMeetingsOptimized: async (
    user: UserType,
    selectedTeam: TeamType,
  ): Promise<{ data: any[] }> => {
    try {
      const res = await serviceDeskInstance.get(
        `/service_desk/${selectedTeam?.id}/knowledge_transition_meetings`
      );

      return res.data;
    } catch (err) {
      console.error('There was an error fetching meetings');
      throw err;
    }
  },

  // Paginated method for knowledge transition meetings
  GetAllKnowledgeTransitionMeetingsPaginated: async (
    user: UserType,
    selectedTeam: TeamType,
    page = 1,
    limit = 50,
  ): Promise<{ data: any[]; total_count: number; page: number; limit: number }> => {
    try {
      const res = await serviceDeskInstance.get(
        `/service_desk/${selectedTeam?.id}/knowledge_transition_meetings?page=${page}&limit=${limit}`
      );

      return res.data;
    } catch (err) {
      console.error('There was an error fetching meetings');
      throw err;
    }
  },
  GetAllP1IntakeMeetings: async (
    user: UserType,
    selectedTeam: TeamType,
  ): Promise<P1IntakeMeetings[]> => {
    try {
      const res = await serviceDeskInstance.get(
        `/service_desk/${user?.org_id}/get_all_p1_intake_meetings`
      );

      const data = (await res.data) as P1IntakeMeetings[];

      return data;
    } catch (err) {
      console.error('There was an error fetching meetings');
    }
  },

  GetP1MeetingDetails: async (
    meetingId: string,
    user: UserType,
  ): Promise<P1Meeting> => {
    try {
      const res = await serviceDeskInstance.get(
        `/service_desk/${meetingId}/get_p1_meeting_details`
      );

      const data = (await res.data) as P1Meeting;

      return data;
    } catch (err) {
      console.error('There was an error fetching meetings');
    }
  },
  GetAllTeams: async (user: UserType): Promise<TeamType[]> => {
    try {
      // Get access control configuration
      const config = await getAccessControlConfig(user?.org_id || '');

      let url;
      if (user?.role === 'Admin' || !config.restrict_meeting_access_to_admin) {
        // Admin can see all teams, or if restriction is disabled, all users can see all teams
        url = `/service_desk/get_all_teams?org_id=${user?.org_id}`;
      } else {
        // When restriction is enabled, non-admin users can only see teams they have permissions for
        const resp = await serviceDeskInstance.get(
          `/service_desk/${user?.id}/team_permissions`
        );

        const teams = resp.data;
        url = '/service_desk/get_all_teams?';
        teams.forEach((element, index) => {
          url += `${index > 0 ? '&' : ''}team_ids=${element.team_id}`;
        });
      }

      // Using the axios instance to make the request
      const response = await serviceDeskInstance.get(url);

      const result = response.data as TeamType[];
      return result;
    } catch (err) {
      console.error(`There was an error fetching Teams: ${err.message}`);
    }
  },

  GetAllTeamsPermissions: async (
    user: UserType,
  ): Promise<TeamPermissionsType[]> => {
    try {
      // Get access control configuration
      const config = await getAccessControlConfig(user?.org_id || '');

      let url: string;
      if (user?.role === 'Admin' || !config.restrict_meeting_access_to_admin) {
        // Admin can see all team permissions, or if restriction is disabled, all users can see all team permissions
        url = `/service_desk/get_all_teams?org_id=${user?.org_id}`;
        const resp = await serviceDeskInstance.get(url);
        return resp.data as TeamPermissionsType[];
      }
      // When restriction is enabled, non-admin users can only see their own team permissions
      const resp = await serviceDeskInstance.get(
        `/service_desk/${user?.id}/team_permissions`
      );
      return resp.data as TeamPermissionsType[];
    } catch (err) {
      console.error(`There was an error fetching Teams: ${err.message}`);
    }
  },

  DeleteTeam: async (
    user,
    teamId: string,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      await serviceDeskInstance.delete(`/service_desk/delete_team/${teamId}`);

      return {
        success: true,
        message: 'Team successfully deleted',
      };
    } catch (err) {
      return {
        success: false,
        message: 'There was an error deleting the team. Please try again.',
      };
    }
  },
  UpdateTeam: async (user, teamId: string, updatedTeamData): Promise<Team> => {
    try {
      const res = await serviceDeskInstance.put(
        `/service_desk/update_team/${teamId}`,
        JSON.stringify(updatedTeamData)
      );

      const data = (await res.data.data[0]) as Team;

      return data;
    } catch (err) {
      console.error(`There was an error updating the team: ${err.message}`);
    }
  },
  CreateIntakeMeeting: async (
    user: UserType,
    meeting_id: string,
    selectedTeam: TeamType,
  ): Promise<IntakeMeetings[]> => {
    try {
      const res = await serviceDeskInstance.post(
        `/service_desk/intake_meeting_details?meeting_id=${meeting_id}&team_id=${selectedTeam?.id}`,
        {}
      );

      const data = (await res.data) as IntakeMeetings[];

      return data;
    } catch (err) {
      console.error('There was an error saving meetings');
    }
  },

  CreateKnowledgeTransitionMeeting: async (
    user: UserType,
    meeting_id: string,
    selectedTeam: TeamType,
  ): Promise<IntakeMeetings[]> => {
    try {
      const res = await serviceDeskInstance.post(
        `/service_desk/insert_knowledge_transition_meetings?meeting_id=${meeting_id}&team_id=${selectedTeam?.id}`,
        {}
      );

      const data = (await res.data) as IntakeMeetings[];

      return data;
    } catch (err) {
      console.error('There was an error saving meetings');
    }
  },
};
