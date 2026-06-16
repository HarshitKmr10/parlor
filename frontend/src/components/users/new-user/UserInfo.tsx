import React, { useCallback, useMemo } from "react";
import { Text, Flex } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useGlobalContext } from "contexts/store";
import { UserFormData } from "utils/validationUtils";
import { useUserForm } from "hooks/useUserForm";
import UserInfoForm from "./UserInfoForm";
import OrganizationUserForm from "./OrganizationUserForm";
import { serviceDeskInstance } from "api/common/axiosInstance";
import { toast } from "react-toastify";

const INVITE_LINK_ENABLED =
  process.env.NEXT_PUBLIC_HAS_USER_INVITE_SECRET === "true";

interface UserInfoProps {
  setIsLoading: (loading: boolean) => void;
  refreshUserData: () => void;
  onClose?: () => void;
}

const initialFormState: UserFormData = {
  fullName: "",
  email: "",
  password: "",
  teamId: "",
  role: "",
  amazonConnectProfile: "",
  serviceNowProfile: "",
};

function UserInfo({ setIsLoading, refreshUserData, onClose }: UserInfoProps) {
  const {
    formData,
    formErrors,
    handleInputChange,
    validateFormData,
    setFormData,
  } = useUserForm(initialFormState);
  const { user, organization } = useGlobalContext();
  const router = useRouter();

  const config = useMemo(() => {
    return JSON.parse(organization?.config || "{}");
  }, [organization]);

  const createTemporaryInviteLink = useCallback(
    async ({
      email,
      role,
      password,
    }: Pick<UserFormData, "email" | "role" | "password">) => {
      const response = await fetch("/api/user-invite-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          role,
          password,
        }),
      });

      let data: { token?: string; expiresAt?: string; error?: string } | null =
        null;

      try {
        data = await response.json();
      } catch (parsingError) {
        console.error("Failed to parse invite link response", parsingError);
      }

      if (!response.ok || !data?.token) {
        throw new Error(
          data?.error || "Failed to generate temporary invite link"
        );
      }

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const inviteUrl = `${origin}/change-password/${data.token}`;

      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        await navigator.clipboard.writeText(inviteUrl);
      }

      let emailSent = false;
      let emailError: string | null = null;
      try {
        const sendResponse = await serviceDeskInstance.post(
          "/service_desk/send-invite-email",
          {
            to: email.toLowerCase(),
            invite_url: inviteUrl,
            invited_by: user?.name || user?.email || null,
            org_name: organization?.name || null,
            expires_at: data.expiresAt || null,
          }
        );
        emailSent = Boolean(sendResponse?.data?.email_sent);
        emailError = sendResponse?.data?.email_error || null;
      } catch (sendError) {
        console.error("Invite email send failed:", sendError);
        const responseError = (sendError as { response?: { data?: { detail?: string; email_error?: string } } })
          ?.response?.data;
        emailError =
          responseError?.detail ||
          responseError?.email_error ||
          (sendError instanceof Error ? sendError.message : "Failed to send invite email");
      }

      return {
        inviteUrl,
        expiresAt: data.expiresAt,
        emailSent,
        emailError,
      };
    },
    [user, organization]
  );


  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsLoading(true);

      const isValid = validateFormData();

      if (!isValid) {
        setIsLoading(false);
        return;
      }

      const profiles = [];
      if (formData.amazonConnectProfile) {
        profiles.push({
          user_id: user?.id,
          profile_type: "Amazon Connect",
          profile_username: formData.amazonConnectProfile,
        });
      }
      if (formData.serviceNowProfile) {
        profiles.push({
          user_id: user?.id,
          profile_type: "ServiceNow",
          profile_username: formData.serviceNowProfile,
        });
      }

      const jsonData = {
        name: formData.fullName,
        email: formData.email.toLowerCase(),
        password: formData.password,
        team_ids: [formData.teamId],
        org_id: user?.org_id,
        role: formData.role,
        profiles,
        assigned_role_ids: formData.assigned_role_ids || [],
      };

      try {
        const response = await serviceDeskInstance.post(
          "/service_desk/create_user",
          jsonData
        );
        if (response.data) {
          if (INVITE_LINK_ENABLED) {
            try {
              const inviteDetails = await createTemporaryInviteLink({
                email: formData.email,
                role: formData.role,
                password: formData.password,
              });

              const expiryText = inviteDetails?.expiresAt
                ? ` Link expires on ${new Date(
                    inviteDetails.expiresAt
                  ).toLocaleString()}.`
                : "";

              if (inviteDetails.emailSent) {
                toast.success(
                  `Invite emailed to ${formData.email}. Link copied to clipboard as backup.${expiryText}`
                );
              } else {
                toast.success(
                  `User created. Temporary link copied to clipboard.${expiryText}`
                );
                toast.warn(
                  `Could not email the invite: ${
                    inviteDetails.emailError ||
                    "share the copied link manually."
                  }`
                );
              }
            } catch (linkError) {
              console.error("Invite link generation failed:", linkError);
              toast.success("User created successfully.");
              toast.error(
                linkError instanceof Error
                  ? linkError.message
                  : "Failed to generate temporary invite link"
              );
            }
          } else {
            toast.success("User created successfully.");
          }

          refreshUserData();
          router.push("/admin/users/users-overview");
        }
      } catch (error) {
        // Extract error message and show toast without closing modal
        const errorMessage =
          error.response?.data?.detail ||
          error.response?.data?.message ||
          "Error creating user";
        toast.error(errorMessage);
        console.error("CREATE USER ERROR:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      formData,
      validateFormData,
      user,
      refreshUserData,
      router,
      setIsLoading,
      createTemporaryInviteLink,
    ]
  );

  // If organization flow is enabled, show the alternative form
  if ("AllowUserCreation" in config && config.AllowUserCreation === false) {
    return (
      <OrganizationUserForm
        orgId={user?.org_id || ""}
        orgName={organization?.name || "Unknown Organization"}
        onClose={onClose || (() => router.push("/admin/users/users-overview"))}
      />
    );
  }

  // Default flow - show the original form
  return (
    <Flex direction="column" gap="2" p="2">
      <Text size="5" weight="bold">
        Add New User
      </Text>
      <Text as="p" size="2" color="gray">
        Add User to your organization
      </Text>
      <UserInfoForm
        formData={formData}
        formErrors={formErrors}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        setFormData={setFormData}
        validateFormData={validateFormData}
      />
    </Flex>
  );
}

export default UserInfo;
