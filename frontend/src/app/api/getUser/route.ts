// src/app/api/getUser/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { serverAxiosInstance } from 'api/common/serverAuth';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { phoneNumber, user } = json;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
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
      const { data: organization } = await serverAxiosInstance.get(
        `/service_desk/get_organization/${encodeURIComponent(user?.org_id)}`
      );

      const config = JSON.parse(organization.config);
      console.log('config', config);
      const ticketingConfig = config.Modules.voice_copilot.ticketing_auth;
      console.log('ticketingConfig', ticketingConfig);

      // Using hardcoded credentials as in original code
      const username = ticketingConfig.username || 'yatish@futurepath.ai';
      const password = ticketingConfig.password || 'Best@123';
      const instanceName = ticketingConfig.instance_name || 'dev209832';

      // Create ServiceNow axios instance
      const serviceNowInstance = axios.create({
        baseURL: `https://${instanceName}.service-now.com/api/now`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
        }
      });

      // Fetch user from ServiceNow
      const { data: userData } = await serviceNowInstance.get('/table/sys_user', {
        params: {
          sysparm_query: `mobile_phone=${encodeURIComponent(phoneNumber)}^ORphone=${encodeURIComponent(phoneNumber)}`
        }
      });

      return NextResponse.json({
        success: true,
        user: userData.result
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
            error: 'Failed to fetch user',
            details: error.response?.statusText || error.message
          },
          { status: error.response?.status || 500 }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('Error in getUser:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}