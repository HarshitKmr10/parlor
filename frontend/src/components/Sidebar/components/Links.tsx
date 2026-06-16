/* eslint-disable */
import React, { useCallback } from "react";
import { IRoute } from "types/navigation";
import NavLink from "components/link/NavLink";
import { usePathname } from "next/navigation";
import { Box, Flex, Tooltip } from "@radix-ui/themes";
import clsx from "clsx";


// Divider component – adjust styling if needed.
const Divider = () => (
  <Box
    style={{
      width: "100%",
      height: "1px",
      backgroundColor: "#ccc",
      opacity: 0.5,
      margin: "8px 0",
    }}
  />
);

export function SidebarLinks(props: { routes: IRoute[] }) {
  const pathname = usePathname();
  const { routes } = props;

  // --- Divider Rule 1: Position below either Training or Knowledge, if present ---
  const knowledgeIndex = routes.findIndex(
    (route) => route.path === "/knowledge/dashboard"
  );
  const trainingIndex = routes.findIndex(
    (route) => route.path === "/train-assist-2"
  );

  // Priority: if Training exists, use that index; otherwise, if Knowledge exists, use that index.
  // If neither is found, we won't place the first divider at all.
  let divider1Index = -1;
  if (trainingIndex !== -1) {
    divider1Index = trainingIndex;
  } else if (knowledgeIndex !== -1) {
    divider1Index = knowledgeIndex;
  }

  // --- Divider Rule 2: Chat Virtual Agent or fallback among Agent Assist / Voice VA / Calls ---
  let divider2Index = -1;
  const hasChatVA = routes.some(
    (route) => route.path === "/chat-virtual-agent"
  );
  if (hasChatVA) {
    divider2Index = routes.findIndex(
      (route) => route.path === "/chat-virtual-agent"
    );
  } else {
    // Fallback among Agent Assist, Voice Virtual Agent, Calls
    const fallbackIndex = routes.reduce((last, route, idx) => {
      if (
        ["/agent-assist", "/voice-virtual-agent", "/calls"].includes(route.path)
      ) {
        return idx > last ? idx : last;
      }
      return last;
    }, -1);
    if (fallbackIndex !== -1) {
      divider2Index = fallbackIndex;
    }
  }

  // Utility to check active route
  const activeRoute = useCallback(
    (routeName: string) => {
      if (routeName === "/home") {
        return false;
      }
      return pathname?.includes(routeName);
    },
    [pathname]
  );

  const createLinks = (routes: IRoute[]) => {
    const elements: React.ReactNode[] = [];

    routes.forEach((route, index) => {
      // Add showCall=true to /calls route
      const href = route.path === '/calls' 
        ? `${route.layout}${route.path}?showCall=true`
        : route.layout + route.path;

      // Render the navigation link
      elements.push(
        <NavLink
          className="rounded-full"
          href={href}
          key={`navlink-${index}`}
        >
          <Flex
            as="div"
            position="relative"
            align="center" // Add this
            justify="center" // You already have this
            className={`cursor-pointer aspect-square ${
              route.path === "/home" ? "" : ""
            }`}
          >
            <Tooltip content={route?.name} side="right">
              <Box
                as="div"
                className={clsx(
                  "text-white w-10 h-10 grid place-items-center rounded-full border-2 ",
                  activeRoute(route.path)
                    ? "border-[#D1D2EE] bg-[#353780]"
                    : "border-[transparent]"
                )}
              >
                {route.icon}
              </Box>
            </Tooltip>
          </Flex>
        </NavLink>
      );

      // -- Divider Rule 1: Below either Training or Knowledge (if not last route) --
      if (
        index === divider1Index &&
        divider1Index !== -1 &&
        index < routes.length - 1
      ) {
        elements.push(<Divider key="divider-training-or-knowledge" />);
      }

      // -- Divider Rule 2: Below Chat Virtual Agent or fallback (if not last route) --
      if (
        index === divider2Index &&
        divider2Index !== -1 &&
        index < routes.length - 1
      ) {
        elements.push(<Divider key="divider-chat-va-or-fallback" />);
      }
    });

    return elements;
  };

  return <>{createLinks(routes)}</>;
}

export default SidebarLinks;
