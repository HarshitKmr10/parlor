// src/app/api/createTicket/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { serverAxiosInstance } from 'api/common/serverAuth';
import axios from 'axios';

interface TicketData {
  short_description: string;
  description: string;
  urgency: string | number;
  impact: string | number;
  caller_id: string;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const {
      subject,
      description,
      urgency,
      impact,
      userSysId,
      user
    } = json;

    // Validate required fields
    if (!subject || !description || !userSysId || !user?.org_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

      const ticketingConfig = config.Modules.agent_assist.ticketing_auth;

      // Get ServiceNow credentials
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

      // Prepare ticket data
      const ticketData: TicketData = {
        short_description: subject,
        description,
        urgency,
        impact,
        caller_id: userSysId,
      };

      // Create ticket in ServiceNow
      const { data: responseData, status } = await serviceNowInstance.post(
        '/table/incident',
        ticketData
      );

      if (status === 201) {
        const incidentSysId = responseData.result.sys_id;
        const ticketLink = `https://${instanceName}.service-now.com/nav_to.do?uri=/incident.do?sys_id=${incidentSysId}`;
        
        return NextResponse.json({
          success: true,
          ticketLink,
          ticket: responseData.result
        });
      }

      return NextResponse.json(
        {
          error: 'Failed to create incident',
          details: responseData
        },
        { status }
      );

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
            error: 'Failed to create incident',
            details: error.response?.data?.error?.message || error.message
          },
          { status: error.response?.status || 500 }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('Error in createTicket:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}