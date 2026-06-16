import { Meeting } from 'types/meetingTypes';

import { UserType } from 'types/common';
import { Chat, HistoryChat, TableData } from 'api/chat/models';
import { formatEmployeeId } from 'utils/stringUtils';
import { coPilotInstance, serviceDeskInstance } from 'api/common/axiosInstance';

/**
 * Extract storage path from full URL
 * Supports Azure Blob Storage and S3 URL formats
 *
 * Azure format: https://{account}.blob.core.windows.net/{container}/{blob}
 * S3 format: https://{bucket}.s3.amazonaws.com/{container}/{object}
 *
 * Returns: container/object_path
 */
const extractStoragePath = (url: string): string => {
  try {
    // If it's already a path (not a URL), return as-is
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return url;
    }

    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Remove leading slash and return the path
    return pathname.startsWith('/') ? pathname.substring(1) : pathname;
  } catch (error) {
    console.error('Error parsing storage URL:', error);
    // If parsing fails, return the original value
    return url;
  }
};

export const fetchDataAsText = async (storageUrl: string) => {
  try {
    // Extract just the storage path from the full URL
    const storagePath = extractStoragePath(storageUrl);

    // Use the proxy endpoint with storage path only
    // The backend will generate the signed URL internally
    const response = await serviceDeskInstance.post('/service_desk/proxy/fetch_content', {
      storage_path: storagePath
    });

    // The proxy returns JSON with content field
    return response.data.content;
  } catch (error) {
    console.error(`Error fetching content from ${storageUrl}:`, error);
    throw error;
  }
};

export const Meetings = {
  async GetMeetingsByIDs(
    meetingIDs: string,
    user: UserType,
  ): Promise<Meeting[]> {
    try {
      const meetingIdsArray = meetingIDs.split(',');
      const res = await coPilotInstance.post(
        `/meetings_by_ids`,
        { meeting_ids: meetingIdsArray }
      );

      const { data } = res.data;

      const transformedMeetings: Meeting[] = data
        .map((item) => ({
          id: item.id,
          title: item.title || 'No title',
          start_timestamp: item.start_timestamp,
          analysis_status: item.analysis_status,
          channel: item.channel || 'No channel',
          meeting_id: item.meeting_id,
          end_timestamp: item.end_timestamp,
          app_id: item.app_id,
          bot_name: item.bot_name,
          call_recording_url: item.call_recording_url,
          listener_id: item.listener_id,
          phone_number: item.phone_number,
          postcall_analysis: item.postcall_analysis,
          postcall_analysis_webhook: item.postcall_analysis_webhook,
          postcall_transcript: item.postcall_transcript,
          link: item.link,
        }))
        .sort(
          (a, b) => new Date(b.start_timestamp).getTime()
            - new Date(a.start_timestamp).getTime(),
        );

      return transformedMeetings;
    } catch (err) {
      console.error('There was an error fetching meetings');
    }

    // if (data.length === 0) {
    //   console.error('No meetings found');
    // }
  },
  async GetMeetingsByID(meetingId: string, user: UserType): Promise<Meeting> {
    try {
      const res = await coPilotInstance.get(`/meetings/${meetingId}`);

      const data = await res.data;
      return data;
    } catch (err) {
      Error(`There was an error fetching meeting for ${meetingId}`);
      // console.error(`There was an error fetching meeting for ${meetingId}`);
    }

    // if (data.length === 0) {
    //   console.error('No meetings found');
    // }
  },

  async GetCallsByMeetingById(meetingId: string, user: UserType): Promise<any> {
    try {
      const res = await coPilotInstance.get(`/meetings/vcp_meeting_by_id?meeting_id=${meetingId}`);

      const data = await res.data;
      return data;
    } catch (err) {
      console.error(`There was an error fetching meeting calls for ${meetingId}:`, err);
      throw err;
    }
  },

  async GetMeetingsByIDRaw(
    meetingIDs: string,
    user: UserType,
  ): Promise<Meeting[] | undefined> {
    try {
      const meetingIdsArray = meetingIDs.split(',');
      const response = await coPilotInstance.post(
        `/meetings_by_ids`,
        { meeting_ids: meetingIdsArray }
      );

      const { data } = response.data; // Assuming the structure is { data: [meeting data] }
      return data;
    } catch (err) {
      console.error('There was an error fetching meetings');
    }
  },
  async JoinMeeting(meeting: Meeting, user: UserType): Promise<any> {
    try {
      const response = await coPilotInstance.post(
        '/join_meeting',
        {
          link: meeting.link,
          bot_name: meeting.bot_name || 'Service Desk Bot',
          meeting_id: meeting.meeting_id,
        }
      );

      const { data } = response;
      return data;
    } catch (err) {
      console.error('There was an error fetching meetings');
      throw err;
    }
  },

  async CreateMeeting(
    meeting: Meeting,
    user: UserType,
  ): Promise<Meeting | undefined> {
    try {
      const response = await coPilotInstance.post('/create_meeting', meeting);

      return response.data;
    } catch (err) {
      console.error('Network response was not ok.');
    }
  },

  async CreateCall(
    meeting: Meeting,
    user: UserType,
  ): Promise<Meeting | undefined> {
    try {
      const response = await coPilotInstance.post('/create_call', meeting);
      return response.data;
    } catch (err) {
      console.error('Network response was not ok.');
    }
  },

  async RemoveBot(botId: string, user: UserType): Promise<any> {
    try {
      const response = await coPilotInstance.post(
        `/remove_bot/${botId}`,
        {}
      );

      const { data } = response;
      return data;
    } catch (err) {
      console.error(`Error in removing bot: ${err}`);
    }
  },

  async GetPostCall(meetingId: string, user: UserType): Promise<any> {
    try {
      const response = await serviceDeskInstance.get(
        `/service_desk/${meetingId}/get_postcall_analysis`
      );

      const { data } = response;
      // Ensure there is at least one item in data array before proceeding
      const results = await Promise.all([
        data.entity ? fetchDataAsText(data.entity) : null,
        data.sentiment ? fetchDataAsText(data.sentiment) : null,
        data.summary ? fetchDataAsText(data.summary) : null,
        data.transcript ? fetchDataAsText(data.transcript) : null,
      ]);

      // Assemble the results into a dictionary
      return {
        entity: results[0],
        sentiment: results[1],
        summary: results[2],
        transcript: results[3],
      };
    } catch (err) {
      console.error('There was an error fetching Postcall Analytics data');
      return {
        entity: null,
        sentiment: null,
        summary: null,
        transcript: null,
      };
    }
  },

  async GetPostCalSummary(meetingId: string): Promise<any> {
    try {
      const response = await coPilotInstance.get(
        `/service_desk/${meetingId}/get_postcall_analysis`
      );

      const { data } = response;

      if (data.length > 0) {
        const results = await Promise.all([
          data[0].summary ? fetchDataAsText(data[0].summary) : null,
        ]);

        return {
          summary: results[0],
        };
      }
      console.error('No data available for this meeting ID');
    } catch (err) {
      console.error('There was an error fetching Postcall Analytics data');
    }
  },

  async GetChatMessages(meetingId: string, user: UserType): Promise<any> {
    try {
      const response = await coPilotInstance.get(`/meetings/${meetingId}/chats`);
      const parsedMessages: Chat[] = [];
      const { data } = response;
      data.data.forEach((chatMessage: Chat) => {
        try {
          const parsedMessage = JSON.parse(chatMessage.message);
          parsedMessages.push(parsedMessage); // Append the parsed JSON object to the list
        } catch (error) {
          console.error('Error parsing chat message:', error);
        }
      });

      return parsedMessages;
    } catch (err) {
      console.error('There was an error fetching Chat');
    }
  },

  async GetChatMessagesByEmployeeId(
    employeeId: string,
    user: UserType,
  ): Promise<HistoryChat[] | undefined> {
    const formatDate = (date) => {
      const dateObject = new Date(date);
      const day = String(dateObject.getDate()).padStart(2, '0');
      const month = String(dateObject.getMonth() + 1).padStart(2, '0');
      const year = dateObject.getFullYear().toString().substr(-2);
      return `${day}/${month}/${year}`;
    };
    try {
      const response = await coPilotInstance.get(
        '/meetings/agents/all_agent_chats'
      );
      const chats = response.data.data;
      const dataFilteredByOrgId = chats.filter(
        (item: TableData) => item.org_id === user.org_id,
      );
      const dataSorted = dataFilteredByOrgId
        .filter((item: TableData) => item.employee_id === employeeId)
        .sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );

      const lastItems = {};

      // Iterate through the sorted list to get the last entry for each agent_assist_id
      dataSorted.forEach((item) => {
        lastItems[item.agent_assist_id] = item;
      });

      // Extract the values, which are the last items for each agent_assist_id
      const lastItemsSortedByCreatedAt: TableData[] = Object.values(lastItems);

      lastItemsSortedByCreatedAt.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      const filteredChats = lastItemsSortedByCreatedAt.map(
        (item: TableData) => ({
          id: item.agent_assist_id,
          message: item.title ?? 'No title',
          employeeId: item.employee_id
            ? formatEmployeeId(item.employee_id)
            : '---',
          date: formatDate(item.created_at),
        }),
      );

      return filteredChats;
    } catch (err) {
      console.error(
        `There was an error fetching Chat for Employee ID ${employeeId}`,
      );
    }
  },
  async GetHistoryChat(user: UserType): Promise<HistoryChat[]> {
    const formatDate = (date) => {
      const dateObject = new Date(date);
      const dayOfWeek = dateObject.toLocaleString('en-US', {
        weekday: 'short',
      });
      const day = dateObject.toLocaleString('en-US', { day: '2-digit' });
      const month = dateObject.toLocaleString('en-US', { month: 'short' });
      const time = dateObject.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${dayOfWeek}, ${day} ${month}, ${time}`;
    };

    try {
      const response = await coPilotInstance.get(
        '/meetings/agents/all_agent_chats'
      );

      const chats = response.data.data;

      // Check if chats is empty or undefined
      if (!chats || chats.length === 0) {
        return []; // Return an empty array if there are no chats
      }

      const dataFilteredByOrgId = chats.filter(
        (item: TableData) => item.org_id === user.org_id,
      );

      if (dataFilteredByOrgId.length === 0) {
        return []; // Return an empty array if there are no chats for the user's org_id
      }

      const dataSorted = dataFilteredByOrgId.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      const lastItems = {};

      dataSorted.forEach((item) => {
        lastItems[item.agent_assist_id] = item;
      });

      const lastItemsSortedByCreatedAt: TableData[] = Object.values(lastItems);

      lastItemsSortedByCreatedAt.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      const fetchedChats = lastItemsSortedByCreatedAt.map((item: any) => ({
        id: item.agent_assist_id,
        message: item.title ?? 'No title',
        employeeId: item.employee_id
          ? formatEmployeeId(item.employee_id)
          : '---',
        date: formatDate(item.created_at),
      }));

      return fetchedChats;
    } catch (err) {
      console.error('Error fetching chat history:', err);
      return []; // Return an empty array in case of an error
    }
  },
  async InsertChatMessage(
    meetingId: string,
    message: string,
    role: string,
    messageId: string,
    user: UserType,
  ): Promise<void> {

    try {
      const response = await coPilotInstance.post(
        `/meetings/${meetingId}/insert_chats?message=${encodeURIComponent(
          message,
        )}&role=${role}&message_id=${messageId}`,
        {}
      );

      if (response.status !== 200) {
        console.error('Failed to insert chat message');
      }
    } catch (err) {
      console.error('Error inserting chat message');
    }
  },
};
