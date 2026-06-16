'use client';

import { PropsWithChildren, createContext, useContext, useState } from 'react';
import { StoreApi, createStore, useStore } from 'zustand';
import { coPilotInstance } from 'api/common/axiosInstance';
import { toast } from 'react-toastify';

class DeviceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceError';
  }
}

type DeviceDetails = {
  id: string;
  userId: string;
  deviceName: string;
  ownerType: string;
  managedDeviceOwnerType: string;
  managementState: string;
  enrolledDateTime: string;
  lastSyncDateTime: string;
  chassisType: string;
  operatingSystem: string;
  deviceType: string;
  complianceState: string;
  jailBroken: string;
  managementAgent: string;
  osVersion: string;
  easActivated: boolean;
  easDeviceId: string;
  easActivationDateTime: string;
  aadRegistered: boolean;
  azureADRegistered: boolean;
  deviceEnrollmentType: string;
  lostModeState: string;
  activationLockBypassCode: string | null;
  emailAddress: string;
  azureActiveDirectoryDeviceId: string;
  azureADDeviceId: string;
  deviceRegistrationState: string;
  deviceCategoryDisplayName: string;
  isSupervised: boolean;
  exchangeLastSuccessfulSyncDateTime: string;
  exchangeAccessState: string;
  exchangeAccessStateReason: string;
  remoteAssistanceSessionUrl: string | null;
  remoteAssistanceSessionErrorDetails: string | null;
  isEncrypted: boolean;
  userPrincipalName: string;
  enrolledByUserPrincipalName: string | null;
  model: string;
  manufacturer: string;
  imei: string;
  complianceGracePeriodExpirationDateTime: string;
  serialNumber: string;
  phoneNumber: string;
  androidSecurityPatchLevel: string;
  userDisplayName: string;
  configurationManagerClientEnabledFeatures: any;
  wiFiMacAddress: string;
  deviceHealthAttestationState: string | null;
  subscriberCarrier: string;
  meid: string;
  totalStorageSpaceInBytes: number;
  freeStorageSpaceInBytes: number;
  managedDeviceName: string;
  partnerReportedThreatState: string;
  retireAfterDateTime: string;
  preferMdmOverGroupPolicyAppliedDateTime: string;
  autopilotEnrolled: boolean;
  requireUserEnrollmentApproval: boolean | null;
  managementCertificateExpirationDate: string;
  iccid: string | null;
  udid: string | null;
  roleScopeTagIds: string[];
  windowsActiveMalwareCount: number;
  windowsRemediatedMalwareCount: number;
  notes: string | null;
  configurationManagerClientHealthState: any;
  configurationManagerClientInformation: any;
  ethernetMacAddress: string | null;
  physicalMemoryInBytes: number;
  processorArchitecture: string;
  specificationVersion: string | null;
  joinType: string;
  skuFamily: string;
  securityPatchLevel: string;
  skuNumber: number;
  managementFeatures: string;
  enrollmentProfileName: string | null;
  bootstrapTokenEscrowed: boolean;
  deviceFirmwareConfigurationInterfaceManaged: boolean;
  deviceIdentityAttestationDetail: any;
  hardwareInformation: any;
  deviceActionResults: any[];
  usersLoggedOn: any[];
  chromeOSDeviceInfo: any[];
  supplementalDeviceDetails: any[];
};

type UserInfo = {
  id: string;
  display_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  office_location: string | null;
};

type DevicesStore = {
  // Device Data
  deviceDetails: DeviceDetails[];
  deviceUserInfo: UserInfo | null;
  loadingDeviceDetails: boolean;
  error: DeviceError | null;
  
  // Configuration
  endpointManagement: boolean;
  endpointSystem: string;
  fetchDeviceInfo: boolean;
  
  // Actions
  setConfig: (config: {
    endpointManagement?: boolean;
    endpointSystem?: string;
    fetchDeviceInfo?: boolean;
  }) => void;
  fetchDeviceDetails: (userDetails: {
    email?: string;
  }) => Promise<void>;
  clearDevices: () => void;
};

const DevicesContext = createContext<StoreApi<DevicesStore> | undefined>(undefined);

export const DevicesProvider = ({ children }: PropsWithChildren) => {
  const [store] = useState(() =>
    createStore<DevicesStore>((set, get) => ({
      // Initial state
      deviceDetails: [],
      deviceUserInfo: null,
      loadingDeviceDetails: false,
      error: null,
      
      // Configuration
      endpointManagement: false,
      endpointSystem: '',
      fetchDeviceInfo: true,

      // Actions
      setConfig: (config) => set((state) => ({
        endpointManagement: config.endpointManagement ?? state.endpointManagement,
        endpointSystem: config.endpointSystem ?? state.endpointSystem,
        fetchDeviceInfo: config.fetchDeviceInfo ?? state.fetchDeviceInfo,
      })),

      clearDevices: () => set({ 
        deviceDetails: [], 
        deviceUserInfo: null, 
        error: null 
      }),

      fetchDeviceDetails: async (userDetails) => {
        const { endpointManagement, endpointSystem, fetchDeviceInfo } = get();
        
        if (
          !userDetails?.email ||
          !endpointManagement ||
          endpointSystem !== 'Intune' ||
          !fetchDeviceInfo ||
          userDetails?.email.length === 0
        ) return;

        set({ loadingDeviceDetails: true, error: null });

        try {
          // Use the new unified endpoint
          const response = await coPilotInstance.post('/api/users/devices', {
            email: userDetails.email,
            include_apps: false,
          });

          const data = response?.data;

          if (data?.success && data?.devices && Array.isArray(data.devices) && data.devices.length > 0) {
            const device = data.devices[0]; // Take the first device
            set({ 
              deviceDetails: device ? [device] : [],
              deviceUserInfo: data?.user_info || null,
            });
          } else {
            console.error('Failed to fetch device details:', data?.message || 'No devices found');
            set({
              error: new DeviceError(data?.message || 'Failed to fetch device details'),
              deviceDetails: [],
              deviceUserInfo: null,
            });
          }
        } catch (e: any) {
          console.error('Error fetching device details:', e);
          set({
            error: new DeviceError(`Failed to fetch device details: ${e.message}`),
            deviceDetails: [],
            deviceUserInfo: null,
          });
        } finally {
          set({ loadingDeviceDetails: false });
        }
      },
    })),
  );

  return (
    <DevicesContext.Provider value={store}>{children}</DevicesContext.Provider>
  );
};

export function useDevicesStore<T>(selector: (state: DevicesStore) => T) {
  const context = useContext(DevicesContext);
  if (!context) {
    throw new Error('DevicesProvider is missing');
  }
  return useStore(context, selector);
}
