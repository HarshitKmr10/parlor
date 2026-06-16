// src/app/api/getRequest/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { serverAxiosInstance } from 'api/common/serverAuth';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { requestNumber, user } = json;

    if (!requestNumber || !user?.org_id) {
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

      // Get ServiceNow credentials from config
      const ticketingConfig = config.Modules.voice_virtual_agent.ticketing_auth;
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

      // Fetch service request
      const { data: serviceRequestData } = await serviceNowInstance.get('/table/sc_request', {
        params: { number: requestNumber }
      });

      const serviceRequest = serviceRequestData.result[0];
      if (!serviceRequest) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      // Add instance information to the service request
      const enrichedServiceRequest = {
        ...serviceRequest,
        _instanceDetails: {
          name: instanceName,
          baseUrl: `https://${instanceName}.service-now.com`
        }
      };

      // Fetch RITM details
      const { data: ritmData } = await serviceNowInstance.get('/table/sc_req_item', {
        params: { request: serviceRequest.sys_id }
      });

      const ritm = ritmData.result[0] || null;

      // Add instance information to RITM if it exists
      const enrichedRitm = ritm ? {
        ...ritm,
        _instanceDetails: {
          name: instanceName,
          baseUrl: `https://${instanceName}.service-now.com`
        }
      } : null;

      return NextResponse.json({
        success: true,
        serviceRequest: enrichedServiceRequest,
        ritm: enrichedRitm,
      });

    } catch (error: any) {
      if (error.response?.status === 401) {
        return NextResponse.json(
          { error: 'Session expired' },
          { status: 401 }
        );
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.error?.message || error.message;

        return NextResponse.json(
          {
            error: 'Failed to fetch request',
            details: message,
            statusCode: status,
          },
          { status }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('Error in getRequest:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}