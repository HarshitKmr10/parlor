// src/app/api/getIncident/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { serverAxiosInstance } from 'api/common/serverAuth';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { incidentNumber, user } = json;

    if (!incidentNumber || !user?.org_id) {
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

      // Get ServiceNow credentials from config or fallback to defaults
      const ticketingConfig = config?.Modules?.agent_assist?.ticketing_auth || {};
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

      // Fetch incident from ServiceNow
      const { data: incidentData } = await serviceNowInstance.get('/table/incident', {
        params: {
          number: incidentNumber,
          sysparm_display_value: 'true',
          sysparm_exclude_reference_link: 'true'
        }
      });

      const incident = incidentData.result[0];
      if (!incident) {
        return NextResponse.json(
          { error: 'Incident not found' },
          { status: 404 }
        );
      }

      // Add instance_name to the incident data
      incident.instance_name = instanceName;

      return NextResponse.json({
        success: true,
        incident,
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
            error: 'Failed to fetch incident',
            details: error.response?.data?.error?.message || error.response?.statusText
          },
          { status: error.response?.status || 500 }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('Error in getIncident:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}