// src/app/api/getAllOpenTickets/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { serverAxiosInstance } from 'api/common/serverAuth';
import axios from 'axios';

// Define the fields we want to retrieve from ServiceNow
const TICKET_FIELDS = [
  'short_description',
  'incident_state',
  'activity_due',
  'task_effective_number',
  'opened_at',
  'caller_id',
  'caller_id.name',
  'caller_id.link',
  'sys_id'
].join(',');

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { user } = json;

    if (!user?.org_id) {
      return NextResponse.json(
        { error: 'Missing organization ID' },
        { status: 400 }
      );
    }

    // Get the access token from cookies
    const accessToken = req.cookies.get('ACCESS_TOKEN')?.value;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token found' },
        { status: 401 }
      );
    }

    try {
      // Use serverAxiosInstance which handles token refresh
      const { data: organization } = await serverAxiosInstance.get(
        `/service_desk/get_organization/${encodeURIComponent(user.org_id)}`
      );

      // Parse organization config
      let config;
      try {
        config = JSON.parse(organization.config);
      } catch (parseError) {
        return NextResponse.json(
          { error: 'Invalid organization configuration' },
          { status: 500 }
        );
      }

      // Get ServiceNow credentials from config
      const ticketingConfig = config.Modules.agent_assist.ticketing_auth;
      const username = ticketingConfig?.username || 'yatish@futurepath.ai';
      const password = ticketingConfig?.password || 'Best@123';
      const instanceName = ticketingConfig?.instance_name || 'dev209832';

      if (!username || !password || !instanceName) {
        return NextResponse.json(
          { error: 'ServiceNow configuration is missing' },
          { status: 500 }
        );
      }

      // Create ServiceNow axios instance
      const serviceNowInstance = axios.create({
        baseURL: `https://${instanceName}.service-now.com/api/now`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
        }
      });

      // Fetch open tickets from ServiceNow
      const { data: ticketData } = await serviceNowInstance.get('/table/incident', {
        params: {
          sysparm_query: 'incident_state=1^ORDERBYsys_created_on',
          sysparm_fields: TICKET_FIELDS
        }
      });

      return NextResponse.json({
        tickets: ticketData.result,
        instanceName
      });

    } catch (error: any) {
      if (error.response?.status === 401) {
        return NextResponse.json(
          { error: 'Session expired' },
          { status: 401 }
        );
      }

      if (axios.isAxiosError(error)) {
        console.error('ServiceNow API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });

        return NextResponse.json({
          error: 'Failed to fetch tickets',
          statusCode: error.response?.status,
          message: error.response?.statusText
        }, {
          status: error.response?.status || 500
        });
      }

      throw error;
    }

  } catch (error) {
    console.error('Error in getAllOpenTickets:', error);
    return NextResponse.json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, {
      status: 500
    });
  }
}