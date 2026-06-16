"use client";

import { useCallback, useEffect } from "react";

import { Flex } from "@radix-ui/themes";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGlobalContext } from "contexts/store";
import { IUserType } from "app/login/page";
import { removeLoginParams } from "@/utils/urlUtils";

// SAML authentication handler component
export default function AuthSaml(): JSX.Element {
  const router = useRouter();
  const { setUser } = useGlobalContext();
  const searchParams = useSearchParams();
  const samlSuccess = searchParams.get("saml_success");
  const authData = searchParams.get("auth_data");

  const handleSamlLogin = useCallback(
    (authDataB64: string): void => {
      try {
        // Decode the base64 encoded auth data
        const authDataJson = atob(authDataB64);
        const data = JSON.parse(authDataJson);

        console.log("SAML authentication data:", data);

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

          console.log("SAML user set successfully:", user);

          // Check for stored next URL from SAML flow
          const storedNextUrl = localStorage.getItem("auth_next_url");
          if (storedNextUrl) {
            localStorage.removeItem("auth_next_url");
            const cleanedNextUrl = removeLoginParams(storedNextUrl);
            console.log("Redirecting to stored URL:", cleanedNextUrl);
            router.push(cleanedNextUrl);
          } else {
            console.log("Redirecting to home");
            router.push("/home");
          }
        } else {
          console.error("SAML authentication failed:", data);
          // Handle SAML auth failure
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
        console.error("SAML login error:", error);
        const storedNextUrl = localStorage.getItem("auth_next_url");
        const loginUrl = storedNextUrl
          ? `/login?e=1&next=${encodeURIComponent(storedNextUrl)}`
          : "/login?e=1";
        if (storedNextUrl) {
          localStorage.removeItem("auth_next_url");
        }
        router.push(loginUrl);
      }
    },
    [setUser, router]
  );

  useEffect(() => {
    console.log("SAML page loaded with params:", { samlSuccess, authData: authData ? "present" : "missing" });
    
    if (samlSuccess === "true" && authData) {
      // Handle SAML authentication
      console.log("Processing SAML authentication...");
      handleSamlLogin(authData);
    } else {
      // No valid SAML parameters, redirect to login
      console.log("No valid SAML parameters, redirecting to login");
      router.push("/login?e=1&error=Invalid SAML response");
    }
  }, [samlSuccess, authData, handleSamlLogin, router]);

  return (
    <Flex justify="center" align="center" height="100vh" direction="column" gap="4">
      <Loader2 className="w-10 h-10 animate-spin" />
      <p className="text-sm text-gray-600">Processing SAML authentication...</p>
    </Flex>
  );
}
