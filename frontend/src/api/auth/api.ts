import { serviceDeskInstance } from "api/common/axiosInstance";
import { CONFIG } from "config";
import { TokenInterface } from "./types";

export const REFRESH_TOKEN_URL = `${CONFIG.SERVICE_DESK_API_URL}/service_desk/refresh`;

export const generateRefreshToken = (refresh_token: string) => {
  return serviceDeskInstance
    .post<TokenInterface>(REFRESH_TOKEN_URL, { refresh_token })
    .then(response => response.data);
};


export const getAzureLogin = () => {
  return serviceDeskInstance.get(`${CONFIG.SERVICE_DESK_API_URL}/service_desk/azure_login`)
    .then(response => response.data);
};
