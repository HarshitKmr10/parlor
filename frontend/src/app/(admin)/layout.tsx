"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "components/Sidebar";
import IncomingCallModal from "components/Modals/IncomingCallModal";
import { useGlobalContext } from "contexts/store";
import { isWindowAvailable } from "utils/validationUtils";
import { Box, Grid } from "@radix-ui/themes";
import routes from "routes";
import Navbar from "components/navbar";
import { TrackJS } from "trackjs";
import useUserRoles from "hooks/useUserRoles";
import { useRouter, useSearchParams } from "next/navigation";
import IncomingCallModalGenesys from "@/components/common/IncomingCallModalGenesys/IncomingCallModalGenesys";

// Mapping configuration
const moduleToRouteMapping = {
  agent_assist: "/agent-assist",
  expert_copilot: "/expert-copilot",
  noc_copilot: "/noc-copilot",
  voice_virtual_agent: "/voice-virtual-agent",
  train_assist: "/train-assist",
  voice_p1_bridge: "/p1/logs",
  voice_copilot: "/calls",
  knowledge_assist: "/knowledge/logs",
  chat_virtual_agent: "/chat-virtual-agent",
  anomaly_detection: "/observability",
  ap_automation: "/ap-automation",
  payroll_copilot: "/payroll-copilot",
  service_bulletin: "/service-bulletin",
  vendor_copilot: "/vendor-copilot",
  lead_copilot: "/lead-copilot",
};

// Define the desired order of routes
const desiredOrder = [
  "/home",
  "/knowledge/dashboard",
  "/train-assist-2",
  "/train-assist",
  "/agent-assist",
  "/voice-virtual-agent",
  "/calls",
  "/chat-virtual-agent",
  "/noc-copilot",
  "/observability",
  "/expert-copilot",
  "/p1/logs",
  "/ap-automation",
  "/payroll-copilot",
  "/service-bulletin",
  "/vendor-copilot",
  "/lead-copilot",
];

interface AdminProps {
  children: React.ReactNode;
}

function Admin({ children }: AdminProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [enabledModules, setEnabledModules] = useState<Record<string, any>>({});
  const [orgConfig, setOrgConfig] = useState(null);
  const {
    user,
    organization,
    device,
    setUser,
    setSelectedTeam,
  } = useGlobalContext();

  const roles = useUserRoles();
  // Parse showSideBar parameter (default to true)
  const showSideBarParam = searchParams.get("showSideBar");
  const showSideBar =
    showSideBarParam === null ? true : showSideBarParam === "true";

  useEffect(() => {
    if (isWindowAvailable()) document.documentElement.dir = "ltr";
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !TrackJS.isInstalled()) {
      TrackJS.install({
        token: "b1095b683d1d4adba0bacde68794ffbd",
        application: "my-app-test",
        userId: user?.id,
      });
    }
  }, [user]);

  useEffect(() => {
    if (organization) {
      try {
        const config = JSON.parse(organization.config);
        setOrgConfig(config);
        setEnabledModules(config.Modules);
      } catch (error) {
        console.error("Error parsing organization config:", error);
      }
    }
  }, [organization]);

  const filteredRoutes = routes.filter((route) => {
    switch (route.path) {
      case "/users":
        return roles.platform_admin;
      case "/calls":
        return (enabledModules.voice_copilot?.enabled && roles.voice_copilot_user) || false;
      case "/agent-assist":
        return (enabledModules.agent_assist?.enabled && roles.agent_assist_user) || false;
      case "/noc-copilot":
        return enabledModules.noc_copilot?.enabled || false;
      case "/voice-virtual-agent":
        return (enabledModules.voice_virtual_agent?.enabled && roles.voice_virtual_agent_user) || false;
      case "/expert-copilot":
        return enabledModules?.expert_copilot?.enabled || false;
      case "/cross-functional-coresolve":
        return enabledModules.cross_functional_co_resolve?.enabled || false;
      case "/p1/logs":
        return enabledModules.voice_p1_bridge?.enabled || false;
      case "/knowledge/dashboard":
        return (enabledModules.knowledge_assist?.enabled && roles.knowledge_assist_user) || false;
      case "/knowledge/logs":
        return (enabledModules.knowledge_assist?.enabled && roles.knowledge_assist_user) || false;
      case "/train-assist":
        return (
          enabledModules.train_assist?.enabled && enabledModules.train_assist?.version !== "v3" && roles.train_assist_user
        );
      case "/train-assist-2":
        return (
          enabledModules.train_assist?.enabled && enabledModules.train_assist?.version === "v3" && roles.train_assist_user
        );
      case "/observability":
        return enabledModules.anomaly_detection?.enabled || false;
      case "/chat-virtual-agent":
        if(process.env.NEXT_PUBLIC_DISABLE_CVA === "true") {
          return false;
        }
        return (enabledModules.chat_virtual_agent?.enabled && roles.chat_virtual_agent_user) || false;
      case "/ap-automation":
        return enabledModules.ap_automation?.enabled || false;
      case "/payroll-copilot":
        return enabledModules.payroll_copilot?.enabled || false;
      case "/service-bulletin":
        return enabledModules.service_bulletin?.enabled || false;
      case "/vendor-copilot":
        return enabledModules.vendor_copilot?.enabled || false;
      case "/lead-copilot":
        return enabledModules.lead_copilot?.enabled || false;
      default:
        return true;
    }
  });

  // Update routes with configured names and sort them
  const updatedRoutes = filteredRoutes
    .map((route) => {
      const moduleKey = Object.keys(moduleToRouteMapping).find(
        (key) => moduleToRouteMapping[key] === route.path
      );
      if (moduleKey) {
        const configuredName = enabledModules[moduleKey]?.name;
        return {
          ...route,
          name: configuredName !== null && configuredName !== undefined ? configuredName : route.name,
        };
      }
      return route;
    })
    .sort((a, b) => {
      const indexA = desiredOrder.indexOf(a.path);
      const indexB = desiredOrder.indexOf(b.path);

      // If both paths are in the desired order array
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      // If only one path is in the desired order array
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      // If neither path is in the desired order array, keep original order
      return 0;
    });


  const handleLogout = () => {
    router.push("/login");
    setUser(null);
    setSelectedTeam(null);
    localStorage.removeItem("user");
    localStorage.removeItem("selectedTeam");
    localStorage.removeItem("ACCESS_TOKEN");
    localStorage.removeItem("REFRESH_TOKEN");
  };

  return (
    <Box>
      <IncomingCallModal device={device} />
      <IncomingCallModalGenesys />
      <Grid
        height="100vh"
        width="100%"
        columns={showSideBar ? "3.5rem 1fr" : "1fr"}
        rows="1fr"
      >
        {false && (
          <Box gridColumn="span 2" height="100%">
            <Navbar handleLogout={handleLogout} />
          </Box>
        )}
        {showSideBar && (
          <Box gridRow="span 1" height="100%">
            <Sidebar
              routes={updatedRoutes}
              showHeader={false}
              handleLogout={handleLogout}
            />
          </Box>
        )}
        <Box className="overflow-y-hidden">{children}</Box>
      </Grid>
    </Box>
  );
}

export default Admin;
