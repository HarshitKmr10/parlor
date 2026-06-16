'use client';
import axios, { AxiosError, AxiosRequestConfig, AxiosRequestHeaders, AxiosResponse } from 'axios';
import { toast } from 'react-toastify';
import { ServerError } from './types';
import { CONFIG } from 'config';
import { generateRefreshToken, REFRESH_TOKEN_URL } from 'api/auth/api';
import { TokenInterface } from 'api/auth/types';
import { setCookie } from 'utils/cookies';

const DEBUG = process.env.NODE_ENV === 'development';

let isLoggingOut = false;

export const globalLogout = (): void => {
  // Guard against multiple concurrent 401s queueing duplicate toasts/redirects.
  if (isLoggingOut) return;
  isLoggingOut = true;

  localStorage.removeItem('user');
  localStorage.removeItem('selectedTeam');
  localStorage.removeItem('ACCESS_TOKEN');
  localStorage.removeItem('REFRESH_TOKEN');

  toast.error('Your session has expired. Please log in again.', {
    autoClose: 1500,
    toastId: 'session-expired',
  });

  // Delay redirect so the toast is visible before navigating away.
  setTimeout(() => {
    window.location.href = '/login';
  }, 1500);
};

let tokenRequestInFlight = false;
let tokenCallbacks: Array<(tokens: TokenInterface) => void> = [];

function resolveAwaitingPromises(tokens: TokenInterface) {
  tokenCallbacks.map(callback => callback(tokens));
  tokenCallbacks = [];
}

// Refreshes the tokens (auth and refresh) and returns a promise of the new token state.
const refreshTokens = async () => {
    // Get the refresh token from the store
    const refreshToken = localStorage.getItem('REFRESH_TOKEN');
    const accessToken = localStorage.getItem('ACCESS_TOKEN');
    
    if (!refreshToken || !accessToken) {
        globalLogout();
        return null;
    }
    if (tokenRequestInFlight) {
      // wait for a response
      const tokenPromise = new Promise<TokenInterface>(resolve => {
        tokenCallbacks.push((token: TokenInterface) => {
          if (token) {
            resolve(token);
          } else {
            resolve(null);
          }
        });
      });
      return tokenPromise;
    } else {
      tokenRequestInFlight = true;
      return generateRefreshToken(refreshToken)
        .then(tokens => {
          if (tokens) {
            localStorage.setItem("ACCESS_TOKEN", tokens.access_token);
            setCookie("ACCESS_TOKEN", tokens.access_token);
          } else {
            globalLogout();
          }
          resolveAwaitingPromises(tokens || null);
          return tokens || null;
        })
        .catch((e: AxiosError) => {
          const errCode = e.response?.status;
          if (errCode && errCode >= 400 && errCode < 500) {
            globalLogout();
            return null;
          }
          resolveAwaitingPromises(null);
          return null;
        })
        .finally(() => {
          tokenRequestInFlight = false;
        });
    }
  };

const requestTransformer = (request: AxiosRequestConfig) => {

    const accessToken = localStorage.getItem('ACCESS_TOKEN');

    const headers = {
        ...request?.headers
    } as AxiosRequestHeaders;

    if (accessToken && !request?.url?.includes(REFRESH_TOKEN_URL)) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    /* eslint-disable no-console */
    if (DEBUG)
        console.info(`%c ${request.method?.toUpperCase()} ===> ${request.url}`, 'background: #62687a; color: #fff');
    /* eslint-enable no-console */

    return { ...request, headers };
};
const requestError = (error: AxiosError) => Promise.reject(error);

const responseTransformer = (response: AxiosResponse) => response;
const responseError = async (error: AxiosError): Promise<AxiosError | void> => {
    const statusCode = error.response?.status || 500;

    if (DEBUG) console.error(statusCode, error.message);

    if (error.config?.url?.includes(REFRESH_TOKEN_URL)) {
        // if refresh token request fails, logout the user
        if (statusCode === 401) {
          globalLogout();
        }
        return Promise.reject(error);
    }

    switch (statusCode) {
        case ServerError.TOKEN_EXPIRED: {
            try {
            // refresh tokens because our access token has expired
                const tokens = await refreshTokens();
                if (error.config && tokens) {
                    error.config.headers.authorization = `Bearer ${tokens.access_token}`;
                } else {
                    return Promise.reject(error);
                }
                // Now resubmit the original request.
                // N.B. We do not await the result of this request and catch any errors within it.
                // See https://nooner.atlassian.net/browse/BB-196 for more.
                return axios(error.config);
            } catch (e) {
                globalLogout();
                return Promise.reject(e);
            }
            break;
        }
        default:
            return Promise.reject(error);
    }
};

const serviceDeskInstance = axios.create({
    baseURL: CONFIG.SERVICE_DESK_API_URL,
});
serviceDeskInstance.interceptors.request.use(requestTransformer, requestError);
serviceDeskInstance.interceptors.response.use(responseTransformer,responseError);


const coPilotInstance = axios.create({
    baseURL: CONFIG.COPILOT_API_URL,
});
coPilotInstance.interceptors.request.use(requestTransformer, requestError);
coPilotInstance.interceptors.response.use(responseTransformer,responseError);

const aiAgentInstance = axios.create({
    baseURL: CONFIG.AI_AGENT_API_URL,
});
aiAgentInstance.interceptors.request.use(requestTransformer, requestError);
aiAgentInstance.interceptors.response.use(responseTransformer,responseError);

const serviceNowInstance = axios.create({
  baseURL: CONFIG.NOC_API_URL,
});
serviceNowInstance.interceptors.request.use(requestTransformer, requestError);
serviceNowInstance.interceptors.response.use(responseTransformer, responseError);

const nocApiInstance = axios.create({
    baseURL: CONFIG.NOC_API_URL,
});
nocApiInstance.interceptors.request.use(requestTransformer, requestError);
nocApiInstance.interceptors.response.use(responseTransformer,responseError);

const meetingJoinerInstance = axios.create({
    baseURL: CONFIG.MEETING_JOINER_API_URL,
});
meetingJoinerInstance.interceptors.request.use(requestTransformer, requestError);
meetingJoinerInstance.interceptors.response.use(responseTransformer, responseError);


export { serviceDeskInstance, coPilotInstance, aiAgentInstance, nocApiInstance, serviceNowInstance, meetingJoinerInstance };
