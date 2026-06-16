// utils/msGraphAPI.ts
import axios from 'axios';

export class MSGraphAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MSGraphAPIError';
  }
}

interface UserData {
  id: string;
  displayName: string;
  userPrincipalName: string;
  // Add other fields as needed
}

interface Device {
  deviceName: string;
  operatingSystem: string;
  deviceType: string;
  userDisplayName: string;
  lastSyncTime: string;
  freeStorageSpace: string;
}

interface RawDevice {
  userId: string;
  deviceName: string;
  operatingSystem: string;
  osVersion: string;
  model: string;
  manufacturer: string;
  userDisplayName: string;
  lastSyncDateTime: string;
  freeStorageSpaceInBytes: number;
  totalStorageSpaceInBytes: number;
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  authority: string,
): Promise<string> {
  const tokenEndpoint = `${authority}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'https://graph.microsoft.com/.default',
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });

  try {
    const response = await axios.post(tokenEndpoint, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error obtaining access token:', error);
    throw new MSGraphAPIError('Failed to obtain access token');
  }
}

async function getUserByEmail(
  email: string,
  accessToken: string,
): Promise<UserData> {
  const url = `https://graph.microsoft.com/v1.0/users/${email}`;
  try {
    const response = await axios.get<UserData>(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 404) {
      return null;
    }
    return response.data;
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    return null;
    // throw new MSGraphAPIError('Failed to fetch user data');
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

async function listUserDevices(
  userId: string,
  accessToken: string,
): Promise<Device[]> {
  const url = 'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices';
  try {
    const response = await axios.get<{ value: RawDevice[] }>(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data.value
      .filter((device: RawDevice) => device.userId === userId)
      .map((device: RawDevice) => ({
        deviceName: device.deviceName,
        operatingSystem: `${device.operatingSystem}, Version ${device.osVersion}`,
        deviceType: `${device.model}, ${device.manufacturer}`,
        userDisplayName: device.userDisplayName,
        lastSyncTime: formatTimestamp(device.lastSyncDateTime),
        freeStorageSpace: `${(
          device.freeStorageSpaceInBytes
          / 1024 ** 3
        ).toFixed(2)} / ${(device.totalStorageSpaceInBytes / 1024 ** 3).toFixed(
          2,
        )} GB`,
      }));
  } catch (error) {
    console.error('Failed to fetch devices:', error);
    // throw new MSGraphAPIError('Failed to fetch devices');
  }
}

export { getAccessToken, getUserByEmail, listUserDevices };
