// pages/api/getDeviceInfo.ts
import { NextResponse, NextRequest } from "next/server";
import {
  getAccessToken,
  getUserByEmail,
  listUserDevices,
  MSGraphAPIError,
} from "utils/msGraphAPI";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    // if (!email) {
    //   return NextResponse.json(
    //     { error: 'Email is required' },
    //     { status: 400 }
    //   );
    // }

    const clientId = process.env.NEXT_PUBLIC_CLIENT_ID;
    const clientSecret = process.env.NEXT_PUBLIC_CLIENT_SECRET;
    const authority =
      `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_TENANT_ID}`;

    if (!clientId || !clientSecret || !authority) {
      console.error("Missing MS Graph API configuration");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const accessToken = await getAccessToken(clientId, clientSecret, authority);
    const user = await getUserByEmail(email, accessToken);
    if (!user) {
      return NextResponse.json({ success: true, deviceInfo: null });
    }
    const devices = await listUserDevices(user.id, accessToken);

    if (devices.length > 0) {
      return NextResponse.json({ success: true, deviceInfo: devices[0] });
    }
    return NextResponse.json({ success: true, deviceInfo: null });
  } catch (error) {
    console.error("Error in getDeviceInfo API:", error);

    if (error instanceof MSGraphAPIError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
