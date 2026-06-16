"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname, notFound } from 'next/navigation';
import { useGlobalContext } from 'contexts/store';
import { OrganizationConfig } from 'types/common';
import Spinner from './spinner/spinner';
import useUserRoles from 'hooks/useUserRoles';
import { removeLoginParams } from '@/utils/urlUtils';

const moduleToRoutesMap = {
  agent_assist: ["/agent-assist"],
  voice_copilot: ["/copilot", "/postcall", "/calls"],
  noc_copilot: ["/noc-copilot"],
  voice_virtual_agent: ["/voice-virtual-agent"],
  expert_copilot: ["/expert-copilot"],
  cross_functional_coresolve: ["/cross-functional-coresolve"],
  voice_p1_bridge: ["/p1/logs", "/p1/copilot", "/p1/postcall"],
  knowledge_assist: [
    "/knowledge/dashboard",
    "/knowledge/logs",
    "/knowledge/copilot",
    "/knowledge/postcall",
    "/knowledge/collections",
    "/knowledge/editor/refactor",
    "/knowledge/editor/edit-document",
  ],
  train_assist: ["/train-assist", "/train-assist-2"],
  anomaly_detection: ["/observability"],
  chat_virtual_agent: ["/chat-virtual-agent"],
  ap_automation: ["/ap-automation"],
  payroll_copilot: ["/payroll-copilot"],
  service_bulletin: ["/service-bulletin"],
  vendor_copilot: ["/vendor-copilot"],
  lead_copilot: ["/lead-copilot"],
};

export default function withAuth<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WithAuth(props: P) {
    const { user, setUser, organization, setSelectedTeam } = useGlobalContext();
    const router = useRouter();
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorizedRoute, setIsAuthorizedRoute] = useState(false);
    const roles = useUserRoles();

    useEffect(() => {
      if (!user || !localStorage.getItem("ACCESS_TOKEN")) {
        // Preserve the current URL including search params as a query parameter when redirecting to login
        // Clean the URL to remove any parameters that should be removed after login
        const currentPath = pathname;
        const searchParams =
          typeof window !== "undefined" ? window.location.search : "";
        const fullUrl = currentPath + searchParams;
        const cleanedUrl = removeLoginParams(fullUrl);
        const loginUrl = `/login?next=${encodeURIComponent(cleanedUrl)}`;
        router.push(loginUrl);
      } else if (organization) {
        try {
          const config: OrganizationConfig = JSON.parse(organization?.config);
          const modules = config.Modules;

          // Check if current route is authorized using the same logic as layout.tsx
          const isRouteAuthorized = () => {
            // Always allow access to profile and home
            if (pathname === '/profile' || pathname === '/home') {
              return true;
            }

            if (pathname === '/cross-functional-coresolve') {
              return modules['cross_functional_co_resolve']?.enabled || false;
            }

            // Platform admin routes
            if (pathname === '/admin/users/users-overview') {
              return roles.agent_assist_admin || roles.train_assist_admin || roles.knowledge_assist_admin || roles.is_tag_lead;
            }

            // Org-level security settings (OTP toggle + bypass list) — platform admins only
            if (pathname === '/security') {
              return roles.platform_admin;
            }

            if (pathname === '/analytics/agent-assist') {
              return roles.agent_assist_admin;
            }

            // Module-specific route checks
            if (pathname.startsWith('/agent-assist')) {
              return (modules['agent_assist']?.enabled && roles.agent_assist_user) || false;
            }
            
            if (pathname.startsWith('/calls') || pathname === '/copilot' || pathname === '/postcall') {
              return (modules['voice_copilot']?.enabled && roles.voice_copilot_user) || false;
            }
            
            if (pathname.startsWith('/noc-copilot')) {
              return modules['noc_copilot']?.enabled || false;
            }
            
            if (pathname.startsWith('/voice-virtual-agent')) {
              return (modules['voice_virtual_agent']?.enabled && roles.voice_virtual_agent_user) || false;
            }
            
            if (pathname.startsWith('/expert-copilot')) {
              return modules['expert_copilot']?.enabled || false;
            }
            
            if (pathname.startsWith('/p1/')) {
              return modules['voice_p1_bridge']?.enabled || false;
            }
            
            if (pathname.startsWith('/knowledge/')) {
              return (modules['knowledge_assist']?.enabled && roles.knowledge_assist_user) || false;
            }
            
            if (pathname.startsWith('/train-assist')) {
              return (modules['train_assist']?.enabled && roles.train_assist_user) || false;
            }
            
            if (pathname.startsWith('/observability')) {
              return modules['anomaly_detection']?.enabled || false;
            }
            
            if (pathname.startsWith('/chat-virtual-agent')) {
              if(process.env.NEXT_PUBLIC_DISABLE_CVA === "true") {
                return false;
              }
              return (modules['chat_virtual_agent']?.enabled && roles.chat_virtual_agent_user) || false;
            }

            if (pathname.startsWith('/apps')) {
              return modules['tech_ops']?.enabled || false;
            }

            if (pathname.startsWith('/ap-automation')) {
              return modules['ap_automation']?.enabled || false;
            }

            if (pathname.startsWith('/payroll-copilot')) {
              return modules['payroll_copilot']?.enabled || false;
            }

            if (pathname.startsWith('/service-bulletin')) {
              return modules['service_bulletin']?.enabled || false;
            }

            if (pathname.startsWith('/vendor-copilot')) {
              return modules['vendor_copilot']?.enabled || false;
            }

            if (pathname.startsWith('/lead-copilot')) {
              return modules['lead_copilot']?.enabled || false;
            }

            // Default to false for unknown routes
            return false;
          };

          setIsAuthorizedRoute(isRouteAuthorized());
          setIsLoading(false);
        } catch (error) {
          setIsLoading(false);
          console.error("Error parsing organization config:", error);
        }
      }
    }, [user, organization, pathname, router, roles]);

    if (isLoading) {
      return <Spinner />;
    }

    if (!isAuthorizedRoute) {
      if (user) {
        router.push("/home");
      } else {
        notFound();
      }
      
    }

    return <Component {...props} />;
  };
}
