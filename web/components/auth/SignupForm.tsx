"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { postJson } from "@/lib/api/browser";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  workspaceName?: string;
};

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (name.trim().length < 2) errors.name = "Tell us your name.";
    if (!isValidEmail(email)) errors.email = "Enter a valid email address.";
    if (password.length < 8)
      errors.password = "Use at least 8 characters.";
    if (workspaceName.trim().length < 2)
      errors.workspaceName = "Name your workspace.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(undefined);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await postJson("/api/auth/signup", {
        name: name.trim(),
        email: email.trim(),
        password,
        workspaceName: workspaceName.trim(),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Couldn't create your account. Try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
        label="Work email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
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
      <TextField
        label="Workspace name"
        placeholder="Acme Inc."
        value={workspaceName}
        onChange={(event) => setWorkspaceName(event.target.value)}
        error={fieldErrors.workspaceName}
        hint="Your team's home in Parlor. You can rename it later."
        required
      />

      {formError && (
        <p
          role="alert"
          className="rounded-md bg-error-bg px-3 py-2 text-sm text-error"
        >
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-sage-700 underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
