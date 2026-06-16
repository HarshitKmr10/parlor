// src/utils/cookies.ts
import Cookies from 'js-cookie';

export const cookieOptions = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/'
};

export const setCookie = (name: string, value: string) => {
  Cookies.set(name, value, cookieOptions);
};

export const getCookie = (name: string): string | undefined => {
  return Cookies.get(name);
};

export const removeCookie = (name: string) => {
  Cookies.remove(name, cookieOptions);
};

export const setAuthCookies = (accessToken: string, refreshToken: string) => {
  setCookie('ACCESS_TOKEN', accessToken);
  setCookie('REFRESH_TOKEN', refreshToken);
};

export const clearAuthCookies = () => {
  removeCookie('ACCESS_TOKEN');
  removeCookie('REFRESH_TOKEN');
};