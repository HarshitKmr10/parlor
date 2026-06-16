"use client";

import { useCallback, useEffect } from "react";

import { Flex } from "@radix-ui/themes";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { API } from "api";
import { useGlobalContext } from "contexts/store";
import { IUserType } from "app/login/page";
import { removeLoginParams } from "@/utils/urlUtils";
// Home component that handles user authentication and module routing
export default function AuthMicrosoft(): JSX.Element {
  const router = useRouter();
  const { setUser } = useGlobalContext();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const handleAzureLogin = useCallback(
    async (code: string, state: string): Promise<void> => {
      try {
        const data = await API.User.AzureLogin(code, state);

        if (data.status === "authorized" && data.access_token) {
          const user: IUserType = {
            id: data.data.id,
            name: data.data.name,
            email: data.data.email,
            org_id: data.data.org_id,
            role: data.data.role,
            profile_pic: data.data.profile_pic,
            calendar: data.data.calendar || "sample_calendar.com",
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            tag_lead: data.data.tag_lead,
          };
          setUser(user);

          // Check for stored next URL from Microsoft OAuth flow
          const storedNextUrl = localStorage.getItem("auth_next_url");
          if (storedNextUrl) {
            localStorage.removeItem("auth_next_url");
            // Remove any query parameters that should be removed after login
            const cleanedNextUrl = removeLoginParams(storedNextUrl);
            router.push(cleanedNextUrl);
          } else {
            router.push("/home");
          }
        } else {
          // Check for stored next URL for error redirect
          const storedNextUrl = localStorage.getItem("auth_next_url");
          const loginUrl = storedNextUrl
            ? `/login?e=1&next=${encodeURIComponent(storedNextUrl)}`
            : "/login?e=1";
          if (storedNextUrl) {
            localStorage.removeItem("auth_next_url");
          }
          router.push(loginUrl);
        }
      } catch (error) {
        // Check for stored next URL for error redirect
        const storedNextUrl = localStorage.getItem("auth_next_url");
        const loginUrl = storedNextUrl
          ? `/login?e=1&next=${encodeURIComponent(storedNextUrl)}`
          : "/login?e=1";
        if (storedNextUrl) {
          localStorage.removeItem("auth_next_url");
        }
        router.push(loginUrl);
        console.error("Login error:", error);
      }
    },
    [setUser, router]
  );

  useEffect(() => {
    if (code && state) {
      handleAzureLogin(code, state);
    } else {
      router.push("/login");
    }
  }, [code, state, handleAzureLogin, router]);

  return (
    <Flex justify="center" align="center" height="100vh">
      <Loader2 className="w-10 h-10 animate-spin" />
    </Flex>
  );
}
