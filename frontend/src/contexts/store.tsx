"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  Dispatch,
  SetStateAction,
  useMemo,
} from "react";
import { API } from "api";
import { TeamType } from "types/teamTypes";
import { UserType } from "types/userTypes";
import { Organization } from "types/common";
import { Device as TwilioDevice } from "@twilio/voice-sdk";
import { Recommendation } from "types/dashboard";
import { setAuthCookies, clearAuthCookies, getCookie } from "utils/cookies";
import { reloadTranslationsForUser } from "helper/i18n";

interface ContextProps {
  selectedTeam: TeamType | null;
  setSelectedTeam: Dispatch<SetStateAction<TeamType | null>>;
  user: UserType | null;
  setUser: Dispatch<SetStateAction<UserType | null>>;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  device: TwilioDevice | null;
  setDevice: Dispatch<SetStateAction<TwilioDevice | null>>;
  organization: Organization | null;
  setOrganization: Dispatch<SetStateAction<Organization | null>>;
  refetchOrganization: () => Promise<void>;
  sessionId: string | null;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  appId: string | null;
  setAppId: Dispatch<SetStateAction<string | null>>;
  selectedRecommendation: Recommendation | null;
  setSelectedRecommendation: Dispatch<SetStateAction<Recommendation | null>>;
  previousPath: string;
  setPreviousPath: Dispatch<SetStateAction<string>>;
  assignedRoles: string[];
  setAssignedRoles: Dispatch<SetStateAction<string[]>>;
}

const GlobalContext = createContext<ContextProps | undefined>(undefined);

// ─── Helpers ─────────────────────────────────────────────
const getStoredTeam = (): TeamType | null => {
  const storedTeam = localStorage?.getItem("selectedTeam");
  return storedTeam ? JSON.parse(storedTeam) : null;
};

const getStoredUser = (): UserType | null => {
  const storedUser = localStorage?.getItem("user");
  return storedUser ? JSON.parse(storedUser) : null;
};

const getDarkModePreference = (): boolean => {
  const savedPreference = localStorage?.getItem("darkMode");
  return savedPreference ? JSON.parse(savedPreference) : false;
};

const manageDarkMode = (isDarkMode: boolean): void => {
  document.body.classList.toggle("dark", isDarkMode);
};

const storeSelectedTeam = (selectedTeam: TeamType | null): void => {
  localStorage?.setItem("selectedTeam", JSON.stringify(selectedTeam));
};

const decodeJWT = (token: string) => {
  try {
    // Split the token into its three parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];

    // Add padding if necessary for base64url decoding
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);

    // Replace URL-safe characters
    const base64 = paddedPayload.replace(/-/g, '+').replace(/_/g, '/');

    // Decode and parse
    const decoded = JSON.parse(atob(base64));
    return decoded as {
      sub: string;
      role: string;
      org_id: string;
      assigned_roles: string[];
      exp: number;
    };
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    return null;
  }
};

const storeUser = async (user: UserType | null, setAssignedRoles: Dispatch<SetStateAction<string[]>>): Promise<void> => {
  localStorage?.setItem("user", JSON.stringify(user));
  if (user?.access_token) {
    localStorage?.setItem("ACCESS_TOKEN", user?.access_token);

    const decoded = decodeJWT(user?.access_token);
    setAssignedRoles(decoded?.assigned_roles || []);
  }
  if (user?.refresh_token) {
    localStorage?.setItem("REFRESH_TOKEN", user.refresh_token);
  }
  if (user?.access_token && user?.refresh_token) {
    setAuthCookies(user?.access_token, user?.refresh_token);
  }

  // Reload translations after user data is stored
  if (user) {
    await reloadTranslationsForUser();
  }
};

const setupDevice = async (
  user: UserType,
  setDevice: Dispatch<SetStateAction<TwilioDevice | null>>,
  setOrganization: Dispatch<SetStateAction<Organization | null>>
): Promise<void> => {
  try {
    const response = await API.User.GetOrganizations(user?.org_id, user);
    if (response) {
      setOrganization(response);
      const phoneNumber = response.phone;
      const config = JSON.parse(response.config);
      const phoneIntegrationEnabled =
        config.Modules.voice_copilot.enabled &&
        config.Modules.voice_copilot.features.phoneIntegration.enabled;

      if (phoneNumber && phoneIntegrationEnabled) {
        const tokenResponse = await API.User.GetTwilioToken(phoneNumber);
        if (!tokenResponse) return;
        const { token } = tokenResponse;

        const { Device } = await import("@twilio/voice-sdk");
        
        

        const newDevice = new Device(token);

        // Add event listeners for debugging
        newDevice.on("registered", () => {
          console.log("Twilio Device registered successfully");
        });
        
        newDevice.on("unregistered", () => {
          console.log("Twilio Device unregistered");
        });
        
        newDevice.on("error", (error) => {
          console.error("Twilio Device error:", error);
        });

        // Add incoming call handler at device level for debugging
        newDevice.on("incoming", (call) => {
          console.log("Call custom parameters:", call.customParameters);
        });

        // Register the device to enable incoming calls
        await newDevice.register();
        setDevice(newDevice);
      }
    }
  } catch (error) {
    console.error(
      `Error fetching token or initializing Twilio Device: ${error}`
    );
  }
};

const validateAndSetTeam = async (
  selectedTeam: TeamType | null,
  user: UserType | null,
  setSelectedTeam: Dispatch<SetStateAction<TeamType | null>>
): Promise<void> => {
  if (selectedTeam && user) {
    const teams = await API.Teams.GetAllTeams(user);
    const isValid = teams?.some((team) => team.id === selectedTeam.id);

    if (!isValid) {
      setSelectedTeam(null);
      localStorage?.removeItem("selectedTeam");
    }
  }
};

// ─── Provider ─────────────────────────────────────────────
export function GlobalContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [device, setDevice] = useState<TwilioDevice | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamType | null>(
    getStoredTeam()
  );
  const [
    selectedRecommendation,
    setSelectedRecommendation,
  ] = useState<Recommendation | null>(null);
  const [user, setUser] = useState<UserType | null>(getStoredUser());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    getDarkModePreference()
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [previousPath, setPreviousPath] = useState<string>("");
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);

  useEffect(() => {
    manageDarkMode(isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    validateAndSetTeam(selectedTeam, user, setSelectedTeam);
  }, [selectedTeam, user]);

  useEffect(() => {
    storeSelectedTeam(selectedTeam);
  }, [selectedTeam]);

  useEffect(() => {
    const handleUserChange = async (newUser: UserType | null) => {
      storeUser(newUser, setAssignedRoles);
      if (newUser) {
        await setupDevice(newUser, setDevice, setOrganization);
      } else {
        setDevice(null);
        setOrganization(null);
      }
    };

    handleUserChange(user);
  }, [user]);

  const toggleDarkMode = () => {
    setIsDarkMode((prevMode) => {
      const newMode = !prevMode;
      localStorage?.setItem("darkMode", JSON.stringify(newMode));
      return newMode;
    });
  };

  const refetchOrganization = async () => {
    if (user) {
      try {
        const response = await API.User.GetOrganizations(user?.org_id, user);
        if (response) {
          setOrganization(response);
        }
      } catch (error) {
        console.error("Failed to refetch organization", error);
      }
    }
  };

  const contextValue = useMemo(
    () => ({
      selectedTeam,
      setSelectedTeam,
      user,
      setUser,
      isDarkMode,
      toggleDarkMode,
      device,
      setDevice,
      organization,
      setOrganization,
      refetchOrganization,
      sessionId,
      setSessionId,
      appId,
      setAppId,
      selectedRecommendation,
      setSelectedRecommendation,
      previousPath,
      setPreviousPath,
      assignedRoles,
      setAssignedRoles,
    }),
    [
      selectedTeam,
      user,
      isDarkMode,
      device,
      organization,
      selectedRecommendation,
      previousPath,
    ]
  );

  return (
    <GlobalContext.Provider value={contextValue}>
      {children}
    </GlobalContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────
export const useGlobalContext = (): ContextProps => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error(
      "useGlobalContext must be used within a GlobalContextProvider"
    );
  }
  return context;
};
