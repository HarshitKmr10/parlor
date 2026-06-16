import { useState, useEffect } from 'react';
import { fetchData } from 'utils/apiUtils';

class DeviceDetailsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceDetailsError';
  }
}

export const useDeviceDetails = (
  email: string,
  endpointManagement: boolean,
  endpointSystem: string,
) => {
  const [deviceDetails, setDeviceDetails] = useState([]);
  const [loadingDeviceDetails, setLoadingDeviceDetails] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchIntuneDeviceInfo = async () => {
      setLoadingDeviceDetails(true);
      setError(null);
      try {
        if (!email) {
          return;
        }

        const data = await fetchData('/api/getDeviceInfo', 'POST', { email });

        setDeviceDetails(data.deviceInfo || []);
      } catch (err) {
        console.error('Error fetching device details:', err);
        // setError(new DeviceDetailsError(`Failed to fetch device details: ${err instanceof Error ? err.message : 'Unknown error'}`));
        setDeviceDetails([]);
      } finally {
        setLoadingDeviceDetails(false);
      }
    };

    if (
      email
      && email.length > 0
      && endpointManagement
      && endpointSystem === 'Intune'
    ) {
      fetchIntuneDeviceInfo();
    } else {
      setLoadingDeviceDetails(false);
      setDeviceDetails([]);
    }
  }, [email, endpointManagement, endpointSystem]);

  return { deviceDetails, loadingDeviceDetails, error };
};
