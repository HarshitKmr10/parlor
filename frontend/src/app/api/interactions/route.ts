// src/app/api/interaction/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { serverAxiosInstance } from 'api/common/serverAuth';
import axios from 'axios';

// Define the fields to retrieve from ServiceNow
const INTERACTION_FIELDS = [
  // Basic interaction details
  'sys_id',
  'number',
  'state',
  'state_reason',
  'duration',
  'direction',

  // Timestamps
  'opened_at',
  'closed_at',
  'sys_created_on',
  'sys_updated_on',

  // User details with names and sys_ids for navigation
  'opened_by',
  'opened_by.name',
  'opened_by.sys_id',

  'assigned_to',
  'assigned_to.name',
  'assigned_to.sys_id',

  'closed_by',
  'closed_by.name',
  'closed_by.sys_id',

  'opened_for',
  'opened_for.name',
  'opened_for.sys_id',

  // Status flags
  'virtual_agent',
  'help_requested',
  'auto_resolution',
  'active',

  // Metadata
  'category',
  'subcategory',
  'csat_score',
  'sentiment',
  'chat_summary',
].join(',');

export async function POST(req: NextRequest) {
  try {
    const { interactionId, user } = await req.json();

    // Validate required parameters
    if (!interactionId || !user) {
      return NextResponse.json(
        {
          error: 'Missing required data',
          details: 'Interaction ID and user are required',
        },
        { status: 400 }
      );
    }

    if (!user?.org_id) {
      return NextResponse.json(
        {
          error: 'Invalid user data',
          details: 'org_id is required',
        },
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

      if (!organization?.config) {
        return NextResponse.json(
          {
            error: 'Invalid organization data',
            details: 'Organization config is missing',
          },
          { status: 500 }
        );
      }

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

      const ticketingConfig = config?.Modules?.chat_virtual_agent?.ticketing_auth;

      // Get ServiceNow credentials
      const username = ticketingConfig?.username || 'yatish@futurepath.ai';
      const password = ticketingConfig?.password || 'Best@123';
      const instanceName = ticketingConfig?.instance_name || 'dev209832';

      if (!username || !password || !instanceName) {
        return NextResponse.json(
          { error: 'Missing ServiceNow configuration' },
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

      // Fetch interaction from ServiceNow
      const { data: interactionData } = await serviceNowInstance.get(
        `/table/interaction/${interactionId}`,
        {
          params: {
            sysparm_fields: INTERACTION_FIELDS
          }
        }
      );

      return NextResponse.json({
        success: true,
        interaction: interactionData.result,
        instance: instanceName // Include instance name for frontend URL construction
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

        return NextResponse.json(
          {
            error: 'ServiceNow Error',
            details: error.response?.data || error.message
          },
          { status: error.response?.status || 500 }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('Error fetching interaction:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : error.toString()
      },
      { status: 500 }
    );
  }
}