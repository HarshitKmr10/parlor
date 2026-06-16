"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Box, Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { API } from "api";
import AuthBackground from "@/components/auth/AuthBackground";

const schema = z.object({
  email: z
    .string()
    .min(1, "Please enter your email address")
    .email("Please enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
    mode: "onBlur",
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = handleSubmit(async ({ email }) => {
    setErrorMessage(null);
    try {
      await API.User.RequestPasswordReset(email);
      setSubmittedEmail(email);
    } catch (error) {
      console.error("Forgot password failed:", error);
      setErrorMessage(
        "Something went wrong. Please try again in a moment."
      );
    }
  });

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
      <Card className="w-full max-w-xl rounded-3xl border-none bg-white/95 p-8 shadow-2xl">
        {submittedEmail ? (
          <Flex direction="column" gap="4" align="center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F2F4FF] text-[#6941C6]">
              <Mail size={22} />
            </div>
            <Heading
              as="h2"
              size="6"
              weight="bold"
              className="text-[#111322] text-center"
            >
              Check your email
            </Heading>
            <Text size="3" color="gray" className="text-center">
              If an account with <strong>{submittedEmail}</strong> exists,
              we&apos;ve sent a password reset link. The link expires in 60
              minutes.
            </Text>
            <Text size="2" color="gray" className="text-center">
              Didn&apos;t get the email? Check your spam folder, or wait a
              minute and request again.
            </Text>
            <Button
              asChild
              className="mt-2 h-11 w-full bg-[#7358FF] text-white hover:bg-[#5E45E0]"
            >
              <Link href="/login">Back to sign-in</Link>
            </Button>
          </Flex>
        ) : (
          <Flex direction="column" gap="5">
            <Box>
              <Heading
                as="h2"
                size="7"
                weight="bold"
                className="text-[#111322]"
              >
                Forgot your password?
              </Heading>
              <Text size="3" color="gray" className="mt-2 block">
                Enter the email tied to your account and we&apos;ll send you a
                link to reset your password.
              </Text>
            </Box>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-[#111322]"
                >
                  Email <span className="text-[#D92D20]">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register("email")}
                  className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm text-[#111322] outline-none transition focus:ring-2 focus:ring-[#E0D5FF] ${
                    errors.email
                      ? "border-[#F97066] bg-[#FFF4F3] focus:border-[#F97066]"
                      : "border-[#E0E2EC] bg-white focus:border-[#7750F8]"
                  }`}
                />
                {errors.email ? (
                  <Text size="2" color="red" className="mt-2 block">
                    {errors.email.message}
                  </Text>
                ) : null}
              </div>

              {errorMessage ? (
                <Text size="2" color="red">
                  {errorMessage}
                </Text>
              ) : null}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 h-12 w-full cursor-pointer bg-[#7358FF] text-base font-semibold text-white hover:bg-[#5E45E0] disabled:cursor-not-allowed disabled:bg-[#C8C4F0]"
              >
                {isSubmitting ? "Sending…" : "Send reset link"}
              </Button>

              <Flex justify="center" mt="1">
                <Link
                  href="/login"
                  className="text-sm font-medium text-[#6941C6] hover:text-[#5E45E0]"
                >
                  Back to sign-in
                </Link>
              </Flex>
            </form>
          </Flex>
        )}
      </Card>
    </Flex>
  );
}
