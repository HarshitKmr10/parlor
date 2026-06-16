"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Flex } from "@radix-ui/themes";
import { useGlobalContext } from "contexts/store";
import { API } from "api";
import LoginCard from "./LoginCard";
import OtpCard from "./OtpCard";
import { CONFIG } from "@/config";
import { removeLoginParams } from "@/utils/urlUtils";
import AuthBackground from "@/components/auth/AuthBackground";

// Type definitions for user
export interface IUserType {
  id: string;
  name: string;
  email: string;
  org_id: string;
  role: string;
  profile_pic: string;
  calendar: string;
  access_token: string;
  refresh_token: string;
  tag_lead: any;
}

interface LoginFormInputs {
  email: string;
  password: string;
}

// Main login component
function Login() {
  const { setUser, user } = useGlobalContext();
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string>("");
  const [credentials, setCredentials] = useState<LoginFormInputs>({
    email: "",
    password: "",
  });
  const [loginMethod, setLoginMethod] = useState<"email" | "microsoft" | "all">(
    "all"
  );
  const [agreeToTerms, setAgreeToTerms] = useState<boolean>(false);
  const [otpState, setOtpState] = useState<{
    sessionId: string;
    emailMasked?: string;
  } | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const searchParams = useSearchParams();
  const error = searchParams.get("e");
  const nextUrl = searchParams.get("next");
  const redirectOauth = searchParams.get("redirectOauth");

  // Redirect if user is already authenticated
  useEffect(() => {
    const accessToken = localStorage.getItem("ACCESS_TOKEN");
    if (accessToken || user) {
      // If user has access token or is already logged in, redirect to home or nextUrl
      const redirectUrl = nextUrl ? removeLoginParams(nextUrl) : "/home";
      router.push(redirectUrl);
    }
  }, [user, router, nextUrl]);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const { name, value } = event.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };


  useEffect(() => {
    if (error) {
      setAuthErrorMessage("User not found !!");
      setLoading(false);
      // Preserve the next URL when redirecting on error
      const loginUrl = nextUrl
        ? `/login?next=${encodeURIComponent(nextUrl)}`
        : "/login";
      router.push(loginUrl);
    }
  }, [error, nextUrl, router]);

  const finalizeAuthorizedLogin = (data: {
    access_token?: string;
    refresh_token?: string;
    data: IUserType;
  }): void => {
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
    const redirectUrl = nextUrl ? removeLoginParams(nextUrl) : "/home";
    router.push(redirectUrl);
  };

  // Handle form submission
  const handleSubmit = async (formData: LoginFormInputs): Promise<void> => {
    setLoading(true);
    setAuthErrorMessage("");

    try {
      const { email, password } = formData;
      const data = await API.User.Login(email, password);

      if (data?.status === "otp_required" && data.otp_session_id) {
        setOtpState({
          sessionId: data.otp_session_id,
          emailMasked: data.email_masked || email,
        });
        setLoading(false);
        if (data.email_sent === false && data.email_error) {
          setAuthErrorMessage(
            `We tried to email a code but it failed: ${data.email_error}`
          );
        }
        return;
      }

      if (data?.status === "authorized" && data.access_token) {
        setFailedAttempts(0);
        finalizeAuthorizedLogin(data as never);
      } else {
        setFailedAttempts((prev) => prev + 1);
        setAuthErrorMessage("Login failed. Please check your credentials.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Login error:", error);
      setFailedAttempts((prev) => prev + 1);
      setAuthErrorMessage("An error occurred during login. Please try again.");
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (code: string): Promise<void> => {
    if (!otpState?.sessionId) return;
    setLoading(true);
    setAuthErrorMessage("");
    try {
      const data = await API.User.VerifyOTP(otpState.sessionId, code);
      if (data?.status === "authorized" && data.access_token) {
        finalizeAuthorizedLogin(data as never);
      } else {
        setAuthErrorMessage("Invalid code. Please try again.");
        setLoading(false);
      }
    } catch (error) {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Invalid or expired code. Please try again.";
      setAuthErrorMessage(message);
      setLoading(false);
    }
  };

  const handleOtpResend = async (): Promise<void> => {
    if (!otpState?.sessionId) return;
    setAuthErrorMessage("");
    try {
      const result = await API.User.ResendOTP(otpState.sessionId);
      if (!result.email_sent) {
        setAuthErrorMessage(
          result.email_error || "Could not resend code. Please try again."
        );
      }
    } catch (error) {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Could not resend the code. Please try again.";
      setAuthErrorMessage(message);
    }
  };

  const handleBackToLogin = (): void => {
    setOtpState(null);
    setAuthErrorMessage("");
  };

  if (redirectOauth === "true") {
    if (nextUrl) {
      // Remove any query parameters that should be removed after login
      const cleanedNextUrl = removeLoginParams(nextUrl);
      console.log("cleanedNextUrl", cleanedNextUrl);
      localStorage.setItem("auth_next_url", cleanedNextUrl);
    }
    const baseUrl = CONFIG.SERVICE_DESK_API_URL.endsWith('/') ? CONFIG.SERVICE_DESK_API_URL : CONFIG.SERVICE_DESK_API_URL + '/';
    window.location.href = new URL('service_desk/azure_login_redirect', baseUrl).toString();
    return;
  }

  return (
    <Flex
      direction="row"
      align="center"
      justify="center"
      position="relative"
      style={{
        backgroundImage: "linear-gradient(to bottom right, #868cff, #4318ff)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      className="min-h-screen w-full"
    >
      <AuthBackground />
      {otpState ? (
        <OtpCard
          emailMasked={otpState.emailMasked}
          loading={loading}
          authErrorMessage={authErrorMessage}
          onSubmit={handleOtpSubmit}
          onResend={handleOtpResend}
          onBackToLogin={handleBackToLogin}
        />
      ) : (
        <LoginCard
          onSubmit={handleSubmit}
          loading={loading}
          authErrorMessage={authErrorMessage}
          setAuthErrorMessage={setAuthErrorMessage}
          credentials={credentials}
          handleInputChange={handleInputChange}
          loginMethod={loginMethod}
          setLoginMethod={setLoginMethod}
          setLoading={setLoading}
          nextUrl={nextUrl}
          agreeToTerms={agreeToTerms}
          setAgreeToTerms={setAgreeToTerms}
          failedAttempts={failedAttempts}
        />
      )}
    </Flex>
  );
}

export default Login;
