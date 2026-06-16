import { SanitizedQueryParams } from "@/config/constants";

/**
 * Removes specified query parameters from a URL
 * @param url - The URL to process
 * @param paramsToRemove - Array of parameter names to remove
 * @returns The URL with specified parameters removed
 */
export function removeQueryParams(url: string, paramsToRemove: string[]): string {
  try {
    const urlObj = new URL(url, window.location.origin);
    paramsToRemove.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    return urlObj.pathname + urlObj.search;
  } catch (error) {
    console.error('Error processing URL:', error);
    return url;
  }
}

/**
 * Removes query parameters that should be removed after login
 * @param url - The URL to process
 * @returns The URL with login-specific parameters removed
 */
export function removeLoginParams(url: string): string {
  return removeQueryParams(url, SanitizedQueryParams);
} 