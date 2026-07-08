"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { postJson } from "@/lib/api/browser";

type Props = {
  token: string;
  /** ``true`` when the invited email has no account yet — collect a password. */
  requiresSignup: boolean;
};

type FieldErrors = {
  name?: string;
  password?: string;
};

export function InviteAcceptForm({ token, requiresSignup }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    if (!requiresSignup) return true;
    const errors: FieldErrors = {};
    if (name.trim().length < 2) errors.name = "Tell us your name.";
    if (password.length < 8) errors.password = "Use at least 8 characters.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(undefined);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await postJson(`/api/invites/${token}/accept`, requiresSignup
        ? { name: name.trim(), password }
        : {});
      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Couldn't accept this invite. Try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {requiresSignup && (
        <>
          <TextField
            label="Your name"
            autoComplete="name"
            placeholder="Maya Okonkwo"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fieldErrors.name}
            required
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            required
          />
        </>
      )}

      {formError && (
        <p
          role="alert"
          className="rounded-md bg-error-bg px-3 py-2 text-sm text-error"
        >
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting
          ? "Joining…"
          : requiresSignup
            ? "Create account & join"
            : "Accept invite"}
      </Button>
    </form>
  );
}
