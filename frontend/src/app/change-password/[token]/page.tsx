import Link from "next/link";
import { headers } from "next/headers";
import { Card, Flex, Text, Button } from "@radix-ui/themes";
import AuthBackground from "@/components/auth/AuthBackground";
import PasswordSetupCard from "./PasswordSetupCard";
import { InvitePayload } from "@/utils/userInvite";

const buildBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  const headerList = headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";

  if (!host) {
    throw new Error("Unable to resolve request host");
  }

  return `${protocol}://${host}`;
};

const fetchInviteDetails = async (token: string): Promise<InvitePayload> => {
  const baseUrl = buildBaseUrl();
  const response = await fetch(`${baseUrl}/api/user-invite-link/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as
    | InvitePayload
    | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in data && data.error
        ? data.error
        : "Invalid or expired invite link"
    );
  }

  if (
    !("email" in data) ||
    !("password" in data) ||
    !("role" in data) ||
    !("expiresAt" in data)
  ) {
    throw new Error("Invalid invite link payload");
  }

  return data as InvitePayload;
};

const InviteErrorCard = ({ message }: { message: string }) => (
  <Card className="w-full max-w-xl rounded-3xl border-none bg-white/95 p-8 shadow-2xl">
    <Flex direction="column" gap="4" align="center">
      <Text size="6" weight="bold" className="text-[#111322]">
        Invite Link Issue
      </Text>
      <Text size="3" color="gray" className="text-center">
        {message}
      </Text>
      <Button asChild className="h-11 w-full bg-[#7358FF] text-white hover:bg-[#5E45E0]">
        <Link href="/login">Back to Login</Link>
      </Button>
    </Flex>
  </Card>
);

interface ChangePasswordPageProps {
  params: { token: string };
}

export default async function ChangePasswordPage({
  params,
}: ChangePasswordPageProps) {
  let inviteDetails: InvitePayload | null = null;
  let errorMessage: string | null = null;

  try {
    inviteDetails = await fetchInviteDetails(params.token);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to validate invite link";
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
      {inviteDetails ? (
        <PasswordSetupCard invite={inviteDetails} token={params.token} />
      ) : (
        <InviteErrorCard
          message={errorMessage ?? "Invalid or expired invite link"}
        />
      )}
    </Flex>
  );
}

