import type { ComponentType } from "react";
import {
  DashboardIcon,
  MeetingsIcon,
  SearchIcon,
  HighlightIcon,
  TasksIcon,
  ReportIcon,
  TargetIcon,
  AskIcon,
  IntegrationsIcon,
  SettingsIcon,
} from "@/components/ui/icons";

export type NavLink = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

export const NAV_LINKS: readonly NavLink[] = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  { label: "Meetings", href: "/meetings", icon: MeetingsIcon },
  { label: "Search", href: "/search", icon: SearchIcon },
  { label: "Highlights", href: "/highlights", icon: HighlightIcon },
  { label: "Action items", href: "/action-items", icon: TasksIcon },
  { label: "Trackers", href: "/trackers", icon: TargetIcon },
  { label: "Reports", href: "/reports", icon: ReportIcon },
  { label: "Ask", href: "/ask", icon: AskIcon },
  { label: "Integrations", href: "/integrations", icon: IntegrationsIcon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];
