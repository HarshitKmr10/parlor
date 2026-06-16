// src/app/api/updateIncident/route.ts
import { NextResponse, NextRequest } from "next/server";
import { serverAxiosInstance } from 'api/common/serverAuth';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { incidentSysId, description, user } = json;

    if (!incidentSysId || !user?.org_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
          { error: "Invalid organization configuration" },
          { status: 500 }
        );
      }

      // Get ServiceNow credentials from config or fallback to defaults
      const ticketingConfig = config?.Modules?.agent_assist?.ticketing_auth || {};
      const username = ticketingConfig?.username || process.env.SERVICENOW_DEFAULT_USERNAME;
      const password = ticketingConfig?.password || process.env.SERVICENOW_DEFAULT_PASSWORD;
      const instanceName = ticketingConfig?.instance_name || process.env.SERVICENOW_DEFAULT_INSTANCE;

      if (!username || !password || !instanceName) {
        return NextResponse.json(
          { error: "ServiceNow configuration is missing" },
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

      // Prepare update data
      const ticketData = {
        description,
        work_notes: `Updated by ${user.email || "system"} at ${new Date().toISOString()}`
      };

      // Update the incident
      const { data: updateData } = await serviceNowInstance.patch(
        `/table/incident/${incidentSysId}`,
        ticketData
      );

      const updatedIncidentSysId = updateData.result.sys_id;
      const ticketLink = `https://${instanceName}.service-now.com/nav_to.do?uri=/incident.do?sys_id=${updatedIncidentSysId}`;

      try {
        // Fetch the updated incident details
        const { data: updatedIncidentData } = await serviceNowInstance.get(
          `/table/incident/${updatedIncidentSysId}`
        );

        return NextResponse.json({
          success: true,
          ticketLink,
          updatedData: updatedIncidentData.result
        });
      } catch (fetchError) {
        console.warn("Failed to fetch updated incident details:", fetchError);
        // Return success with just the update data if fetching details fails
        return NextResponse.json({
          success: true,
          ticketLink,
          updatedData: updateData.result
        });
      }

    } catch (error: any) {
      if (error.response?.status === 401) {
        return NextResponse.json(
          { error: "Session expired" },
          { status: 401 }
        );
      }

      if (axios.isAxiosError(error)) {
        console.error("ServiceNow API Error:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });

        return NextResponse.json(
          {
            error: "Failed to update incident",
            details: error.response?.data?.error?.message || error.response?.statusText
          },
          { status: error.response?.status || 500 }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error("Error in updateIncident:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}