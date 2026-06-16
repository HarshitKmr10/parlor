// src/app/api/getUser/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { CONFIG } from 'config';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { phoneNumber, user } = json;
    if (!phoneNumber || !user?.org_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch organization configuration
    const orgResponse = await fetch(
      `${CONFIG.SERVICE_DESK_API_URL}/service_desk/get_organization/${encodeURIComponent(user.org_id)}`,
      {
        headers: {
          'Authorization': `Bearer ${user?.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!orgResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch organization' },
        { status: orgResponse.status }
      );
    }

    const organization = await orgResponse.json();

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

    // Construct ServiceNow URL with query parameters
    const queryParams = new URLSearchParams({
      sysparm_query: `mobile_phone=${encodeURIComponent(phoneNumber)}`,
      sysparm_display_value: 'true',
      sysparm_exclude_reference_link: 'true',
      sysparm_fields: 'sys_id,user_name,email,mobile_phone,name,first_name,last_name'  // Add fields you need
    });

    const url = `https://${instanceName}.service-now.com/api/now/table/sys_user?${queryParams}`;
    const AUTH_TOKEN = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ ServiceNow API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      return NextResponse.json(
        { 
          error: 'Failed to fetch user',
          details: response.statusText
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.result?.length) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      user: data.result[0]
    });

  } catch (error) {
    
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}