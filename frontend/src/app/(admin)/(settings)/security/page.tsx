"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  IconButton,
  Switch,
  Table,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  EnvelopeClosedIcon,
  InfoCircledIcon,
  LockClosedIcon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import withAuth from "components/withAuth";
import Spinner from "components/spinner/spinner";
import { serviceDeskInstance } from "api/common/axiosInstance";
import { useGlobalContext } from "contexts/store";

interface SecuritySettings {
  org_id: string;
  otp_enabled: boolean;
  email_provider_configured: boolean;
}

interface BypassEntry {
  id: string;
  email: string;
  reason: string | null;
  created_by: string | null;
  created_at: string | null;
}

function SecurityPage() {
  const { user } = useGlobalContext();
  const orgId = user?.org_id;

  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);
  const [savingToggle, setSavingToggle] = useState<boolean>(false);

  const [bypassEntries, setBypassEntries] = useState<BypassEntry[]>([]);
  const [loadingBypass, setLoadingBypass] = useState<boolean>(true);
  const [submittingBypass, setSubmittingBypass] = useState<boolean>(false);
  const [bypassEmail, setBypassEmail] = useState<string>("");
  const [bypassReason, setBypassReason] = useState<string>("");

  const fetchSettings = useCallback(async () => {
    if (!orgId) return;
    setLoadingSettings(true);
    try {
      const response = await serviceDeskInstance.get<SecuritySettings>(
        `/service_desk/organization/${encodeURIComponent(orgId)}/security-settings`
      );
      setSettings(response.data);
    } catch (error) {
      console.error("Failed to load security settings", error);
      toast.error("Failed to load security settings.");
    } finally {
      setLoadingSettings(false);
    }
  }, [orgId]);

  const fetchBypassList = useCallback(async () => {
    setLoadingBypass(true);
    try {
      const response = await serviceDeskInstance.get<{ items: BypassEntry[] }>(
        "/service_desk/admin/otp-bypass-list"
      );
      setBypassEntries(response.data.items || []);
    } catch (error) {
      console.error("Failed to load bypass list", error);
      toast.error("Failed to load OTP bypass list.");
    } finally {
      setLoadingBypass(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchBypassList();
  }, [fetchSettings, fetchBypassList]);

  const handleToggleOtp = async (next: boolean) => {
    if (!orgId) return;
    setSavingToggle(true);
    try {
      const response = await serviceDeskInstance.patch<SecuritySettings>(
        `/service_desk/organization/${encodeURIComponent(orgId)}/security-settings`,
        { otp_enabled: next }
      );
      setSettings((prev) =>
        prev
          ? { ...prev, otp_enabled: response.data.otp_enabled }
          : { ...response.data, email_provider_configured: false }
      );
      toast.success(
        next
          ? "Email OTP is now required at sign-in."
          : "Email OTP is disabled for your organization."
      );
    } catch (error) {
      console.error("Failed to update security settings", error);
      toast.error("Could not update setting. Please try again.");
    } finally {
      setSavingToggle(false);
    }
  };

  const handleAddBypass = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = bypassEmail.trim().toLowerCase();
    if (!trimmed) return;
    setSubmittingBypass(true);
    try {
      const response = await serviceDeskInstance.post<BypassEntry>(
        "/service_desk/admin/otp-bypass-list",
        { email: trimmed, reason: bypassReason.trim() || null }
      );
      setBypassEntries((prev) => [response.data, ...prev]);
      setBypassEmail("");
      setBypassReason("");
      toast.success(`Added ${trimmed} to bypass list.`);
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to add bypass entry.";
      toast.error(detail);
    } finally {
      setSubmittingBypass(false);
    }
  };

  const handleRemoveBypass = async (id: string, email: string) => {
    try {
      await serviceDeskInstance.delete(
        `/service_desk/admin/otp-bypass-list/${encodeURIComponent(id)}`
      );
      setBypassEntries((prev) => prev.filter((row) => row.id !== id));
      toast.success(`Removed ${email}.`);
    } catch (error) {
      console.error("Failed to remove bypass entry", error);
      toast.error("Failed to remove entry.");
    }
  };

  const providerConfigured = settings?.email_provider_configured ?? false;
  const otpEnabled = settings?.otp_enabled ?? false;

  const headerStatus = useMemo(() => {
    if (loadingSettings) return null;
    if (!providerConfigured) {
      return (
        <Badge color="orange" size="2" variant="soft">
          <CrossCircledIcon /> Email provider not configured
        </Badge>
      );
    }
    return otpEnabled ? (
      <Badge color="green" size="2" variant="soft">
        <CheckCircledIcon /> OTP enforced
      </Badge>
    ) : (
      <Badge color="gray" size="2" variant="soft">
        OTP disabled
      </Badge>
    );
  }, [loadingSettings, providerConfigured, otpEnabled]);

  if (loadingSettings && loadingBypass) {
    return <Spinner />;
  }

  return (
    <Flex direction="column" style={{ height: "100%", width: "100%" }}>
      {/* Header banner */}
      <Box
        style={{
          flexShrink: 0,
          borderBottom: "1px solid var(--gray-4)",
          background: "var(--color-panel-solid)",
        }}
      >
        <Flex
          align="center"
          justify="between"
          px="5"
          py="4"
          style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}
        >
          <Flex align="center" gap="3">
            <Box
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--accent-3)",
                color: "var(--accent-11)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <LockClosedIcon width="18" height="18" />
            </Box>
            <Box>
              <Heading as="h1" size="5" weight="medium">
                Security
              </Heading>
              <Text size="2" color="gray">
                Sign-in protection for your organization
              </Text>
            </Box>
          </Flex>
          {headerStatus}
        </Flex>
      </Box>

      {/* Body */}
      <Box
        style={{
          flexGrow: 1,
          overflow: "auto",
          width: "100%",
          background: "var(--gray-1)",
        }}
      >
        <Flex
          direction="column"
          gap="4"
          px="5"
          py="5"
          style={{ maxWidth: 1100, margin: "0 auto" }}
        >
          {!providerConfigured && (
            <Callout.Root color="orange" variant="surface">
              <Callout.Icon>
                <InfoCircledIcon />
              </Callout.Icon>
              <Callout.Text>
                The platform's email provider isn't configured, so OTP
                enforcement and bypass changes won't take effect until that's
                fixed. Contact your platform admin.
              </Callout.Text>
            </Callout.Root>
          )}

          {/* OTP enforcement card */}
          <Card size="3" variant="surface">
            <Flex direction="column" gap="3" p="2">
              <Flex justify="between" align="start" gap="4" wrap="wrap">
                <Box style={{ maxWidth: 640 }}>
                  <Flex align="center" gap="2" mb="1">
                    <EnvelopeClosedIcon width="16" height="16" />
                    <Heading as="h2" size="4" weight="medium">
                      Email OTP at sign-in
                    </Heading>
                  </Flex>
                  <Text as="p" size="2" color="gray">
                    When enabled, users in this organization must enter a
                    6-digit code emailed to them after their password. Disabled
                    by default.
                  </Text>
                </Box>
                <Flex align="center" gap="3">
                  <Text size="2" color={otpEnabled ? "green" : "gray"}>
                    {otpEnabled ? "Enabled" : "Disabled"}
                  </Text>
                  <Switch
                    size="3"
                    disabled={savingToggle || !providerConfigured}
                    checked={otpEnabled}
                    onCheckedChange={handleToggleOtp}
                  />
                </Flex>
              </Flex>
            </Flex>
          </Card>

          {/* Bypass list card */}
          <Card size="3" variant="surface">
            <Flex direction="column" gap="4" p="2">
              <Box>
                <Heading as="h2" size="4" weight="medium" mb="1">
                  OTP bypass list
                </Heading>
                <Text as="p" size="2" color="gray">
                  Users on this list skip the OTP step even when the
                  organization requires it. Use sparingly — typically for
                  service accounts or break-glass admins.
                </Text>
              </Box>

              {/* Inline add form */}
              <form onSubmit={handleAddBypass}>
                <Flex gap="2" wrap="wrap" align="end">
                  <Box style={{ flex: "1 1 240px", minWidth: 220 }}>
                    <Text as="label" size="1" color="gray" mb="1">
                      Email
                    </Text>
                    <TextField.Root
                      placeholder="user@example.com"
                      type="email"
                      value={bypassEmail}
                      onChange={(event) => setBypassEmail(event.target.value)}
                      required
                    />
                  </Box>
                  <Box style={{ flex: "2 1 280px", minWidth: 240 }}>
                    <Text as="label" size="1" color="gray" mb="1">
                      Reason (optional)
                    </Text>
                    <TextField.Root
                      placeholder="e.g. CI service account"
                      value={bypassReason}
                      onChange={(event) => setBypassReason(event.target.value)}
                    />
                  </Box>
                  <Button
                    type="submit"
                    size="2"
                    disabled={submittingBypass || !bypassEmail.trim()}
                  >
                    <PlusIcon />
                    {submittingBypass ? "Adding…" : "Add to bypass"}
                  </Button>
                </Flex>
              </form>

              {/* Table */}
              <Box
                style={{
                  border: "1px solid var(--gray-4)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {loadingBypass ? (
                  <Box p="4">
                    <Text size="2" color="gray">
                      Loading bypass list…
                    </Text>
                  </Box>
                ) : bypassEntries.length === 0 ? (
                  <Box p="5" style={{ textAlign: "center" }}>
                    <Text size="2" color="gray">
                      No emails on the bypass list yet. Add one above to skip
                      OTP for specific accounts.
                    </Text>
                  </Box>
                ) : (
                  <Table.Root variant="ghost">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Reason</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Added</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {bypassEntries.map((row) => (
                        <Table.Row key={row.id} align="center">
                          <Table.Cell>
                            <Text size="2" weight="medium">
                              {row.email}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2" color={row.reason ? undefined : "gray"}>
                              {row.reason || "—"}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2" color="gray">
                              {row.created_at
                                ? new Date(row.created_at).toLocaleDateString(
                                    undefined,
                                    {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    }
                                  )
                                : "—"}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <IconButton
                              variant="ghost"
                              color="red"
                              aria-label={`Remove ${row.email} from bypass list`}
                              onClick={() =>
                                handleRemoveBypass(row.id, row.email)
                              }
                            >
                              <TrashIcon />
                            </IconButton>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Box>
            </Flex>
          </Card>
        </Flex>
      </Box>
      <ToastContainer position="bottom-right" />
    </Flex>
  );
}

export default withAuth(SecurityPage);
