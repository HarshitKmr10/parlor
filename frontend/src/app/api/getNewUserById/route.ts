// src/app/api/getNewUserById/route.ts
import { NextResponse, NextRequest } from "next/server";
import axios from "axios";
import { serverAxiosInstance } from "api/common/serverAuth";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { userId, user } = json;

    if (!user?.org_id) {
      return NextResponse.json(
        { error: "Missing user or organization ID" },
        { status: 400 }
      );
    }

    // Get the access token from cookies
    const accessToken = req.cookies.get("ACCESS_TOKEN")?.value;
    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token found" },
        { status: 401 }
      );
    }

    try {
      // Use serverAxiosInstance which handles token refresh
      const { data: organization } = await serverAxiosInstance.get(
        `/service_desk/get_organization/${encodeURIComponent(user.org_id)}`
      );

      // Parse config
      let config;
      try {
        config = JSON.parse(organization.config);
      } catch (parseError) {
        return NextResponse.json(
          { error: "Invalid organization configuration" },
          { status: 500 }
        );
      }

      // Check if required config exists
      if (!config?.Modules?.agent_assist?.ticketing_auth) {
        config = {
          Modules: {
            agent_assist: {
              ticketing_auth: {},
            },
          },
        };
      }

      const ticketingConfig = config.Modules.agent_assist.ticketing_auth;

      // Select authentication details based on the presence of ticketing_auth
      const username = ticketingConfig?.username || "yatish@futurepath.ai";
      const password = ticketingConfig?.password || "Best@123";
      const instanceName = ticketingConfig?.instance_name || "dev209832";

      // Create a dedicated axios instance for ServiceNow API
      const serviceNowInstance = axios.create({
        baseURL: `https://${instanceName}.service-now.com/api/now`,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            `${username}:${password}`
          ).toString("base64")}`,
        },
      });

      // Make the ServiceNow API call
      const { data: userData } = await serviceNowInstance.get(
        "/table/sys_user",
        {
          params: {
            sysparm_query: `sys_id=${userId}`,
          },
        }
      );

      return NextResponse.json({
        success: true,
        user: userData.result,
      });
    } catch (error) {
      // Check if error is due to token expiration
      if (error.response?.status === 401) {
        return NextResponse.json({ error: "Session expired" }, { status: 401 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error in getNewUserById:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error },
      { status: 500 }
    );
  }
}
