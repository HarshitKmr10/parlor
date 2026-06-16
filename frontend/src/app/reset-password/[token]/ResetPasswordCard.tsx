"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { Eye, EyeOff, Info, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";
import { API } from "api";

interface ResetPasswordCardProps {
  token: string;
  emailMasked: string | null;
}

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Password must be at least 12 characters long")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/\d/, "Include at least one number")
      .regex(/[^A-Za-z0-9]/, "Include at least one special character"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

const usePasswordStrength = (password: string) =>
  useMemo(() => {
    const rules = [
      password.length >= 12,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /\d/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ];
    const score = rules.filter(Boolean).length;
    const config = [
      { label: "Too Short", color: "#E34935", percent: 20 },
      { label: "Weak", color: "#F79009", percent: 40 },
      { label: "Moderate", color: "#FDB022", percent: 60 },
      { label: "Strong", color: "#2BA84A", percent: 80 },
      { label: "Very Strong", color: "#1E8449", percent: 100 },
    ];
    return config[Math.max(0, Math.min(score, config.length - 1))];
  }, [password]);

export default function ResetPasswordCard({
  token,
  emailMasked,
}: ResetPasswordCardProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formMessage, setFormMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const passwordValue = watch("password");
  const confirmPasswordValue = watch("confirmPassword");
  const passwordStrength = usePasswordStrength(passwordValue);

  const onSubmit = handleSubmit(async (values) => {
    try {
      setFormMessage(null);
      const response = await API.User.ResetPassword(token, values.password);

      if (response?.status === "authorized") {
        reset({ password: "", confirmPassword: "" });
        setFormMessage({
          type: "success",
          text: "Password updated! Redirecting you to sign in…",
        });
        toast.success("Password updated! Redirecting to sign-in…");
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } else {
        throw new Error(
          typeof response?.data === "string"
            ? response.data
            : "Failed to reset password. Please request a new link."
        );
      }
    } catch (error) {
      console.error("Reset password failed:", error);
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail;
      setFormMessage({
        type: "error",
        text:
          detail ||
          (error instanceof Error
            ? error.message
            : "Failed to reset password. Please try again."),
      });
    }
  });

  return (
    <Card className="w-full max-w-xl rounded-3xl border-none bg-white/95 p-8 shadow-2xl">
      <Flex direction="column" gap="6">
        <div>
          <Text size="6" weight="bold" className="text-[#111322]">
            Reset your password
          </Text>
          <br />
          <Text size="3" color="gray" className="mt-2">
            {emailMasked
              ? `Choose a new password for ${emailMasked}.`
              : "Choose a new password for your account."}
          </Text>
        </div>

        <Box className="rounded-2xl bg-[#FAF5FF]">
          <Flex
            align="center"
            gap="3"
            className="rounded-xl border border-[#ECEEF5] bg-white/60 px-4 py-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2F4FF] text-[#6941C6]">
              <ShieldCheck size={18} />
            </div>
            <Text size="2" color="gray">
              Your new password must be at least 12 characters and include
              upper- and lower-case letters, a number, and a symbol.
            </Text>
          </Flex>
        </Box>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div>
            <label className="text-sm font-medium text-[#111322]">
              New password <span className="text-[#D92D20]">*</span>
            </label>
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                {...register("password")}
                placeholder="Enter a new password"
                autoComplete="new-password"
                className={clsx(
                  "w-full rounded-xl border px-4 py-3 text-sm text-[#111322] outline-none transition focus:ring-2 focus:ring-[#E0D5FF]",
                  errors.password
                    ? "border-[#F97066] bg-[#FFF4F3] focus:border-[#F97066]"
                    : "border-[#E0E2EC] bg-white focus:border-[#7750F8]"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#6941C6] hover:bg-[#F2F4FF]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Flex align="center" justify="between" className="mt-3">
              <Text size="2" color="gray">
                Strength:
                <span
                  className="ml-1 font-semibold"
                  style={{ color: passwordStrength.color }}
                >
                  {" "}
                  {passwordStrength.label}
                </span>
              </Text>
              <Tooltip content="At least 12 characters with numbers and symbols">
                <button type="button" className="text-[#6941C6]">
                  <Info size={16} />
                </button>
              </Tooltip>
            </Flex>
            <div className="mt-2 h-1.5 rounded-full bg-[#EEF0FB]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${passwordStrength.percent}%`,
                  backgroundColor: passwordStrength.color,
                }}
              />
            </div>
            {errors.password ? (
              <Text size="2" color="red" className="mt-2 block">
                {errors.password.message}
              </Text>
            ) : null}
          </div>

          <div>
            <label className="text-sm font-medium text-[#111322]">
              Confirm new password <span className="text-[#D92D20]">*</span>
            </label>
            <div className="relative mt-2">
              <input
                type={showConfirmPassword ? "text" : "password"}
                {...register("confirmPassword")}
                placeholder="Confirm your new password"
                autoComplete="new-password"
                className={clsx(
                  "w-full rounded-xl border px-4 py-3 text-sm text-[#111322] outline-none transition focus:ring-2 focus:ring-[#E0D5FF]",
                  errors.confirmPassword ||
                    (confirmPasswordValue && confirmPasswordValue !== passwordValue)
                    ? "border-[#F97066] bg-[#FFF4F3] focus:border-[#F97066]"
                    : "border-[#E0E2EC] bg-white focus:border-[#7750F8]"
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#6941C6] hover:bg-[#F2F4FF]"
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword ? (
              <Text size="2" color="red" className="mt-2 block">
                {errors.confirmPassword.message}
              </Text>
            ) : null}
          </div>

          {formMessage ? (
            <Text
              size="2"
              color={formMessage.type === "success" ? "green" : "red"}
            >
              {formMessage.text}
            </Text>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-12 w-full cursor-pointer bg-[#7358FF] text-base font-semibold text-white hover:bg-[#5E45E0] disabled:cursor-not-allowed disabled:bg-[#C8C4F0]"
          >
            {isSubmitting ? "Saving…" : "Reset password"}
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
    </Card>
  );
}
