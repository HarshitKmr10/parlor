"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
  ClipboardEvent,
} from "react";
import { Box, Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { Mail, Loader2 } from "lucide-react";

interface OtpCardProps {
  emailMasked?: string;
  loading: boolean;
  authErrorMessage: string;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBackToLogin: () => void;
  resendCooldownSeconds?: number;
}

const OTP_LENGTH = 6;
const DEFAULT_RESEND_COOLDOWN = 30;

function OtpCard({
  emailMasked,
  loading,
  authErrorMessage,
  onSubmit,
  onResend,
  onBackToLogin,
  resendCooldownSeconds = DEFAULT_RESEND_COOLDOWN,
}: OtpCardProps) {
  const [digits, setDigits] = useState<string[]>(() =>
    Array<string>(OTP_LENGTH).fill("")
  );
  const [resendCountdown, setResendCountdown] = useState<number>(
    resendCooldownSeconds
  );
  const [resending, setResending] = useState<boolean>(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;
    const timer = window.setTimeout(
      () => setResendCountdown((prev) => prev - 1),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  const code = useMemo(() => digits.join(""), [digits]);
  const submitDisabled = loading || code.length !== OTP_LENGTH;

  const setDigit = (index: number, value: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setDigit(index, "");
      return;
    }
    // If user pasted/typed multiple digits, distribute them.
    if (cleaned.length > 1) {
      const chunk = cleaned.slice(0, OTP_LENGTH - index).split("");
      setDigits((prev) => {
        const next = [...prev];
        chunk.forEach((char, offset) => {
          next[index + offset] = char;
        });
        return next;
      });
      const focusTarget = Math.min(index + chunk.length, OTP_LENGTH - 1);
      inputs.current[focusTarget]?.focus();
      return;
    }
    setDigit(index, cleaned);
    if (index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      setDigit(index - 1, "");
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
    if (event.key === "Enter" && code.length === OTP_LENGTH) {
      event.preventDefault();
      void onSubmit(code);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setDigits(() => {
      const next = Array<string>(OTP_LENGTH).fill("");
      pasted.split("").forEach((char, idx) => {
        next[idx] = char;
      });
      return next;
    });
    const focusTarget = Math.min(pasted.length, OTP_LENGTH - 1);
    inputs.current[focusTarget]?.focus();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitDisabled) return;
    await onSubmit(code);
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || resending) return;
    setResending(true);
    try {
      await onResend();
      setDigits(Array<string>(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
      setResendCountdown(resendCooldownSeconds);
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="w-full max-w-xl rounded-3xl border-none bg-white/95 p-8 shadow-2xl">
      <Flex direction="column" gap="6">
        <Flex direction="column" gap="3" align="start">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F2F4FF] text-[#6941C6]">
            <Mail size={22} />
          </div>
          <Box>
            <Heading
              as="h2"
              size="7"
              weight="bold"
              className="text-[#111322]"
            >
              Verify it&apos;s you
            </Heading>
            <Text size="3" color="gray" className="mt-2 block">
              We sent a 6-digit code to{" "}
              <span className="font-semibold text-[#111322]">
                {emailMasked || "your email"}
              </span>
              . Enter it below to finish signing in.
            </Text>
          </Box>
        </Flex>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Flex justify="between" gap="2" className="w-full">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(node) => {
                  inputs.current[index] = node;
                }}
                value={digit}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                pattern="\d*"
                maxLength={1}
                aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                disabled={loading}
                className={`h-14 w-14 rounded-2xl border bg-white text-center text-2xl font-semibold text-[#111322] outline-none transition focus:ring-4 focus:ring-[#E0D5FF] ${
                  authErrorMessage
                    ? "border-[#F97066] bg-[#FFF4F3] focus:border-[#F97066]"
                    : "border-[#E0E2EC] focus:border-[#7750F8]"
                } disabled:cursor-not-allowed disabled:bg-[#F7F8FB]`}
              />
            ))}
          </Flex>

          {authErrorMessage ? (
            <Text size="2" color="red">
              {authErrorMessage}
            </Text>
          ) : null}

          <Button
            type="submit"
            disabled={submitDisabled}
            className="mt-2 h-12 w-full cursor-pointer bg-[#7358FF] text-base font-semibold text-white hover:bg-[#5E45E0] disabled:cursor-not-allowed disabled:bg-[#C8C4F0]"
          >
            {loading ? (
              <Flex align="center" gap="2" justify="center">
                <Loader2 size={16} className="animate-spin" />
                Verifying…
              </Flex>
            ) : (
              "Verify and sign in"
            )}
          </Button>

          <Flex justify="between" align="center" mt="1">
            <button
              type="button"
              onClick={onBackToLogin}
              disabled={loading}
              className="text-sm font-medium text-[#6941C6] hover:text-[#5E45E0] disabled:opacity-50"
            >
              ← Back to sign-in
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCountdown > 0 || resending || loading}
              className="text-sm font-medium text-[#6941C6] hover:text-[#5E45E0] disabled:cursor-not-allowed disabled:text-[#A3A3B3]"
            >
              {resending
                ? "Sending…"
                : resendCountdown > 0
                ? `Resend in ${resendCountdown}s`
                : "Resend code"}
            </button>
          </Flex>
        </form>

        <Box>
          <Text size="2" color="gray">
            Didn&apos;t get the email? Check your spam folder or contact your
            administrator.
          </Text>
        </Box>
      </Flex>
    </Card>
  );
}

export default OtpCard;
