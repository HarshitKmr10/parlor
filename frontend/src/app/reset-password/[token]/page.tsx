"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Flex, Text } from "@radix-ui/themes";
import { Loader2 } from "lucide-react";
import AuthBackground from "@/components/auth/AuthBackground";
import { API } from "api";
import ResetPasswordCard from "./ResetPasswordCard";

interface ValidationState {
  status: "loading" | "valid" | "invalid";
  emailMasked: string | null;
  errorMessage: string | null;
}

const ResetErrorCard = ({ message }: { message: string }) => (
  <Card className="w-full max-w-xl rounded-3xl border-none bg-white/95 p-8 shadow-2xl">
    <Flex direction="column" gap="4" align="center">
      <Text size="6" weight="bold" className="text-[#111322]">
        Reset link issue
      </Text>
      <Text size="3" color="gray" className="text-center">
        {message}
      </Text>
      <Button
        asChild
        className="h-11 w-full bg-[#7358FF] text-white hover:bg-[#5E45E0]"
      >
        <Link href="/forgot-password">Request a new link</Link>
      </Button>
      <Link
        href="/login"
        className="text-sm font-medium text-[#6941C6] hover:text-[#5E45E0]"
      >
        Back to sign-in
      </Link>
    </Flex>
  </Card>
);

const ResetLoadingCard = () => (
  <Card className="w-full max-w-xl rounded-3xl border-none bg-white/95 p-8 shadow-2xl">
    <Flex direction="column" gap="4" align="center" py="6">
      <Loader2 size={28} className="animate-spin text-[#7358FF]" />
      <Text size="3" color="gray">
        Checking your reset link…
      </Text>
    </Flex>
  </Card>
);

interface ResetPasswordPageProps {
  params: { token: string };
}

export default function ResetPasswordPage({
  params,
}: ResetPasswordPageProps) {
  const [state, setState] = useState<ValidationState>({
    status: "loading",
    emailMasked: null,
    errorMessage: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await API.User.ValidateResetToken(params.token);
        if (cancelled) return;
        if (result?.valid) {
          setState({
            status: "valid",
            emailMasked: result.email_masked ?? null,
            errorMessage: null,
          });
        } else {
          setState({
            status: "invalid",
            emailMasked: null,
            errorMessage: "This password reset link is invalid or has expired.",
          });
        }
      } catch (error) {
        if (cancelled) return;
        const detail =
          (error as { response?: { data?: { detail?: string } } })?.response
            ?.data?.detail;
        setState({
          status: "invalid",
          emailMasked: null,
          errorMessage:
            detail || "This password reset link is invalid or has expired.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.token]);

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
      {state.status === "loading" ? (
        <ResetLoadingCard />
      ) : state.status === "valid" ? (
        <ResetPasswordCard
          token={params.token}
          emailMasked={state.emailMasked}
        />
      ) : (
        <ResetErrorCard
          message={
            state.errorMessage ||
            "This password reset link is invalid or has expired."
          }
        />
      )}
    </Flex>
  );
}
