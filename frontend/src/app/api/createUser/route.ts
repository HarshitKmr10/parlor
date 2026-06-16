// src/app/api/createUser/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { serverAxiosInstance } from 'api/common/serverAuth';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, user } = await req.json();

    if (!phoneNumber || !user?.org_id) {
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

    // Create user data
    const userData = {
      first_name: 'Demo',
      last_name: 'User',
      mobile_phone: phoneNumber,
    };

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

      // Create user in ServiceNow
      const { data: createUserData } = await serviceNowInstance.post(
        '/table/sys_user',
        userData
      );

      return NextResponse.json({
        success: true,
        user: createUserData.result
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
            error: 'Failed to create user',
            details: error.response?.data?.error?.message || error.response?.statusText
          },
          { status: error.response?.status || 500 }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('Error in createUser:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : error.toString()
      },
      { status: 500 }
    );
  }
}