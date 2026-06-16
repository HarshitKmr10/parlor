import { coPilotInstance, serviceDeskInstance } from "api/common/axiosInstance";
import axios from "axios";
import { CONFIG } from "config";
import { UserType, Organization } from "types/common";

export type LoginResponse = {
  status: string;
  access_token?: string;
  token_type?: string;
  data: UserType;
  headers?: { [key: string]: string };
  refresh_token?: string;
  // OTP step (when org has otp_enabled=true)
  otp_required?: boolean;
  otp_session_id?: string;
  email_masked?: string;
  expires_in?: number;
  email_sent?: boolean;
  email_error?: string | null;
};

export type VerifyOTPResponse = {
  status: string;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  data: UserType;
};

export type ResendOTPResponse = {
  email_sent: boolean;
  email_error?: string | null;
  expires_in?: number;
};

export const userInstance = axios.create({
  baseURL: `${CONFIG.SERVICE_DESK_API_URL}`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const User = {
  Login: async (email: string, password: string): Promise<LoginResponse> => {
    try {
      const response = await userInstance.post<LoginResponse>(
        "/service_desk/login",
        {
          email: email.toLowerCase(),
          password,
        }
      );

      if (response.data.status === "otp_required") {
        return {
          status: response.data.status,
          otp_required: true,
          otp_session_id: response.data.otp_session_id,
          email_masked: response.data.email_masked,
          expires_in: response.data.expires_in,
          email_sent: response.data.email_sent,
          email_error: response.data.email_error,
          data: response.data.data,
        };
      }

      if (response.data.status === "authorized") {
        return {
          status: response.data.status,
          access_token: response.data.access_token,
          token_type: response.data.token_type,
          data: response.data.data,
          refresh_token: response.data.refresh_token,
        };
      }
      // Unauthorized, handle according to the API response
      return {
        status: response.data.status,
        data: response.data.data,
        headers: response.data.headers,
      };
    } catch (err) {
      console.error("Error in login:", err);
      console.error("There was an error logging in");
    }
  },

  VerifyOTP: async (
    otpSessionId: string,
    code: string
  ): Promise<VerifyOTPResponse> => {
    const response = await userInstance.post<VerifyOTPResponse>(
      "/service_desk/verify-otp",
      { otp_session_id: otpSessionId, code }
    );
    return response.data;
  },

  ResendOTP: async (otpSessionId: string): Promise<ResendOTPResponse> => {
    const response = await userInstance.post<ResendOTPResponse>(
      "/service_desk/resend-otp",
      { otp_session_id: otpSessionId }
    );
    return response.data;
  },

  RequestPasswordReset: async (
    email: string,
    origin?: string
  ): Promise<{ status: string; message: string }> => {
    const browserOrigin =
      origin ??
      (typeof window !== "undefined" ? window.location.origin : undefined);
    const response = await userInstance.post<{
      status: string;
      message: string;
    }>("/service_desk/forgot_password", {
      email: email.toLowerCase(),
      origin: browserOrigin,
    });
    return response.data;
  },

  ValidateResetToken: async (
    token: string
  ): Promise<{ valid: boolean; email_masked?: string; expires_at?: number }> => {
    const response = await userInstance.post<{
      valid: boolean;
      email_masked?: string;
      expires_at?: number;
    }>("/service_desk/validate_reset_token", { token });
    return response.data;
  },

  ResetPassword: async (
    token: string,
    new_password: string
  ): Promise<{ status: string; data?: string; email?: string }> => {
    const response = await userInstance.post<{
      status: string;
      data?: string;
      email?: string;
    }>("/service_desk/reset_password", { token, new_password });
    return response.data;
  },

  AzureLogin: async (code: string, state: string): Promise<LoginResponse> => {
    try {
      const response = await userInstance.get<LoginResponse>(`/service_desk/azure_login_callback?code=${code}&state=${state}`);
      return response.data;
    } catch (err) {
      console.error('Error in Azure login:', err);
      throw new Error('Error in Azure login');
    }
  },

  GetOrganizations: async (
    org_id: string,
    user: UserType
  ): Promise<Organization> => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
  
    const delays = [2000, 4000, 6000, 8000, 10000]; // in ms
    let attempts = 0;
  
    while (attempts < delays.length + 1) {
      try {
        const response = await serviceDeskInstance.get<Organization>(
          `/service_desk/get_organization_config/${encodeURIComponent(org_id)}`
        );
        return response.data;
      } catch (err: any) {
        const status = err?.response?.status;
        attempts++;
  
        if (status >= 500 && status < 600 && attempts <= delays.length) {
          const delay = delays[attempts - 1];
          console.warn(`Retrying in ${delay / 1000}s (attempt ${attempts})...`);
          await wait(delay);
          continue;
        }
  
        console.error("Failed to fetch organization details:", err);
        throw new Error("Failed to fetch organization details");
      }
    }
  
    throw new Error("Failed to fetch organization details after multiple attempts");
  },

  UpdateUserPersonal: async (user_id: string, name: string): Promise<any> => {
    try {
      const response = await serviceDeskInstance.put(
        `/service_desk/${user_id}/update_user_personal?name=${name}`
      );
      if (response.status !== 200) {
        throw new Error("Failed to update user personal");
      }
      return response.data;
    } catch (err) {
      console.error("Failed to update user personal");
    }
  },

  ChangePasswordWithEmail: async (
    email: string,
    old_password: string,
    new_password: string
  ): Promise<{ status: string; data?: string }> => {
    const response = await userInstance.post<{ status: string; data?: string }>(
      "/service_desk/change_password_with_email",
      { email, old_password, new_password }
    );
    return response.data;
  },

  ChangePassword: async (
    user_id: string,
    old_password: string,
    new_password: string,
    accessToken?: string
  ): Promise<any> => {
    try {
      // Use request body instead of query parameters to avoid encoding issues
      const response = await serviceDeskInstance.post(
        `/service_desk/change_password`,
        {
          user_id,
          old_password,
          new_password,
        },
        accessToken
          ? {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          : undefined
      );
      return response.data;
    } catch (err) {
      throw new Error(err?.response?.data?.message?.split(":")?.[1] ?? "Failed to change password");
    }
  },

  InsertUserProfile: async (
    user_id: string,
    profile_type: string,
    profile_username: string
  ): Promise<any> => {
    try {
      const response = await serviceDeskInstance.post(
        `/service_desk/insert_user_profile`,
        {
          user_id,
          profile_type,
          profile_username,
        }
      );
      if (response.status !== 200) {
        throw new Error("Failed to insert user profile");
      }
      return response.data;
    } catch (err) {
      console.error("Failed to insert user profile");
    }
  },

  GetTwilioToken: async (
    phone_number: string
  ): Promise<{ identity: string; token: string } | undefined> => {
    try {
      const tokenResponse = await coPilotInstance.get<{
        identity: string;
        token: string;
      }>(`/token/${phone_number}`);

      return tokenResponse.data;
    } catch (err) {
      console.error("Failed to fetch twilio token");
    }
  },

  GetUsers: async (
    org_id: string,
    team_id: string,
    user: UserType
  ): Promise<UserType[]> => {
    try {
      const response = await serviceDeskInstance.get<UserType[]>(
        `/service_desk/${org_id}/get_users?key=team_id&value=${team_id}`
      );
      return response.data;
    } catch (err) {
      console.error("Failed to fetch users", err);
      throw new Error("Failed to fetch users");
    }
  },

  GetAllUsers: async (
    org_id: string,
    team_id: string,
    user: UserType
  ): Promise<UserType[]> => {
    try {
      const response = await serviceDeskInstance.get<UserType[]>(
        `/service_desk/${org_id}/get_all_users?key=team_id&value=${team_id}`
      );
      return response.data;
    } catch (err) {
      console.error("Failed to fetch users", err);
      throw new Error("Failed to fetch users");
    }
  },

  GetUserProfile: async (user_id: string, user: UserType): Promise<any> => {
    try {
      const response = await serviceDeskInstance.get(
        `/service_desk/get_user_profile?key=user_id&value=${user_id}`
      );
      return response.data;
    } catch (err) {
      console.error("Failed to fetch user profile", err);
      throw new Error("Failed to fetch user profile");
    }
  },

  UpdateUserProfile: async (
    profile_id: string,
    profile_username: string,
    user: UserType
  ): Promise<any> => {
    try {
      const response = await serviceDeskInstance.put(
        "/service_desk/update_user_profile",
        {
          profile_id,
          profile_username,
        }
      );
      return response.data;
    } catch (err) {
      console.error("Failed to update user profile", err);
      throw new Error("Failed to update user profile");
    }
  },

  DeleteUser: async (userId: string, user: UserType): Promise<any> => {
    try {
      const response = await serviceDeskInstance.delete(
        `/service_desk/delete_user?key=id&value=${userId}`
      );
      return response.data;
    } catch (err) {
      console.error("Failed to delete user", err);
      throw new Error("Failed to delete user");
    }
  },

  AddUser: async (userData: any, user: UserType): Promise<any> => {
    try {
      const response = await serviceDeskInstance.post(
        "/service_desk/create_user",
        userData
      );
      return response.data;
    } catch (err) {
      console.error("Failed to add user", err);
      throw new Error("Failed to add user");
    }
  },

  UpdateUserDataPartial: async (
    user: UserType,
    selectedUserId: string,
    data: Record<string, any>
  ): Promise<any> => {
    try {
      const response = await serviceDeskInstance.put(
        `/service_desk/${selectedUserId}/update_user_data_partial`,
        data,
        {
          params: {
            role: user.role,
          },
        }
      );
      return response.data;
    } catch (err) {
      console.error("Failed to update user data", err);
      throw new Error("Failed to update user data");
    }
  },
};
