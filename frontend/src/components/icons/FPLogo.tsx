import React from "react";
import type { SVGProps } from "react";

type FPLogoProps = SVGProps<SVGSVGElement> & {
  width?: number | string;
  height?: number | string;
};

export function FPLogo({ width = "50", height = "50", ...props }: FPLogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 42 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M0.534263 25.5107L0 27.9823V28H14.0977L14.6836 20.744H23.0767L23.6282 13.8058L14.8387 13.7881L15.373 6.83228L34.0377 6.9029V3.372L39.6389 10.3632L34.0377 17.2308V13.8058H25.1104L23.9557 28H27.7472L28.3504 20.744H35.3476C39.6734 20.744 42 14.8121 42 10.2043C42 5.59647 39.57 0 34.9684 0H12.4432L10.4095 25.5107H0.534263Z"
        fill="url(#paint0_linear_6603_98409)"
      />
      <path
        d="M0.534263 25.5107L0 27.9823V28H14.0977L14.6836 20.744H23.0767L23.6282 13.8058L14.8387 13.7881L15.373 6.83228L34.0377 6.9029V3.372L39.6389 10.3632L34.0377 17.2308V13.8058H25.1104L23.9557 28H27.7472L28.3504 20.744H35.3476C39.6734 20.744 42 14.8121 42 10.2043C42 5.59647 39.57 0 34.9684 0H12.4432L10.4095 25.5107H0.534263Z"
        fill="white"
      />
      <defs>
        <linearGradient
          id="paint0_linear_6603_98409"
          x1="-0.534264"
          y1="28"
          x2="42.7723"
          y2="14.5839"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#F58EF4" />
          <stop offset="1" stop-color="#5D19E0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
