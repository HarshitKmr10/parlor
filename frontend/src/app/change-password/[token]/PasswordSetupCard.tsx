"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Flex,
  Text,
  Box,
  Button,
  Tooltip,
} from "@radix-ui/themes";
import { Mail, ShieldCheck, Eye, EyeOff, Info } from "lucide-react";
import clsx from "clsx";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { InvitePayload } from "@/utils/userInvite";
import { API } from "api";
import { toast } from "react-toastify";

interface PasswordSetupCardProps {
  invite: InvitePayload;
  token: string;
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

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <Flex
    align="center"
    gap="3"
    className="rounded-xl border border-[#ECEEF5] bg-white/60 px-4 py-3"
  >
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2F4FF] text-[#6941C6]">
      {icon}
    </div>
    <div className="flex flex-col">
      <Text size="3" weight="medium" className="text-[#111322]">
        {value}
      </Text>
    </div>
  </Flex>
);

const deriveFirstName = (email: string) => {
  const base = email.split("@")[0] || "friend";
  return base
    .split(/[._-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const PasswordSetupCard = ({ invite, token }: PasswordSetupCardProps) => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formMessage, setFormMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
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

  const firstName = useMemo(() => deriveFirstName(invite.email), [invite.email]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      setFormMessage(null);
      const response = await API.User.ChangePasswordWithEmail(
        invite.email.toLowerCase(),
        invite.password,
        values.password
      );

      if (response?.status === "authorized") {
        reset({
          password: "",
          confirmPassword: "",
        });

        setFormMessage({
          type: "success",
          text: "Password saved! Redirecting you to the login page...",
        });
        toast.success(
          "Password saved! Redirecting you to the login page..."
        );

        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        throw new Error(
          typeof response?.data === "string"
            ? response.data
            : "Failed to complete setup. Please try again."
        );
      }
    } catch (error) {
      console.error("Failed to complete setup:", error);
      setFormMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to complete setup. Please try again.",
      });
    }
  });

  return (
    <Card className="w-full max-w-xl rounded-3xl border-none bg-white/95 p-8 shadow-2xl">
      <Flex direction="column" gap="6">
        <div>
          <Text size="6" weight="bold" className="text-[#111322]">
            Welcome, {firstName}! <span role="img" aria-label="wave">
              👋
            </span>
          </Text>
          <br/>
          <Text size="3" color="gray" className="mt-2">
            Let's set up your password to secure your account.
          </Text>
        </div>

        <Box className="rounded-2xl bg-[#FAF5FF]">
          <Flex direction="column" gap="3">
            <InfoRow icon={<Mail size={18} />} label="Email" value={invite.email} />
            <InfoRow
              icon={<ShieldCheck size={18} />}
              label="Role"
              value={invite.role || "Member"}
            />
          </Flex>
        </Box>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div>
            <label className="text-sm font-medium text-[#111322]">
              Create Password <span className="text-[#D92D20]">*</span>
            </label>
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                {...register("password")}
                placeholder="Enter your password"
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
                Password Strength:
                <span
                  className="ml-1 font-semibold"
                  style={{ color: passwordStrength.color }}
                >
                  {" "}
                  {passwordStrength.label}
                </span>
              </Text>
              <Tooltip content="Use at least 12 characters with numbers & symbols">
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
            {errors.password && (
              <Text size="2" color="red" className="mt-2">
                {errors.password.message}
              </Text>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-[#111322]">
              Confirm Password <span className="text-[#D92D20]">*</span>
            </label>
            <div className="relative mt-2">
              <input
                type={showConfirmPassword ? "text" : "password"}
                {...register("confirmPassword")}
                placeholder="Confirm your password"
                className={clsx(
                  "w-full rounded-xl border px-4 py-3 text-sm text-[#111322] outline-none transition focus:ring-2 focus:ring-[#E0D5FF]",
                  errors.confirmPassword || confirmPasswordValue !== passwordValue
                    ? "border-[#F97066] bg-[#FFF4F3] focus:border-[#F97066]"
                    : "border-[#E0E2EC] bg-white focus:border-[#7750F8]"
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#6941C6] hover:bg-[#F2F4FF]"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <Text size="2" color="red" className="mt-2">
                {errors.confirmPassword.message}
              </Text>
            )}
          </div>

          {formMessage && (
            <Text
              size="2"
              color={formMessage.type === "success" ? "green" : "red"}
            >
              {formMessage.text}
            </Text>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-12 w-full cursor-pointer bg-[#7358FF] text-base font-semibold text-white hover:bg-[#5E45E0] disabled:cursor-not-allowed disabled:bg-[#C8C4F0]"
          >
            {isSubmitting ? "Saving..." : "Complete Setup"}
          </Button>
        </form>
      </Flex>
    </Card>
  );
};

export default PasswordSetupCard;

