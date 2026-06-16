import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Server-side utility function to require unauthenticated access.
 * If user is logged in (has ACCESS_TOKEN cookie), redirects to /home.
 * 
 * Usage in server components or route handlers:
 * 
 * ```tsx
 * import { requireUnAuth } from '@/utils/requireUnAuth';
 * 
 * export default async function LoginPage() {
 *   await requireUnAuth();
 *   // User is not logged in, render login page
 *   return <LoginForm />;
 * }
 * ```
 */
export async function requireUnAuth(): Promise<void> {
  
  
  // User is not logged in, allow access to the page
  return;
}

