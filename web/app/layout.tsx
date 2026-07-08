import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Geist_Mono } from "next/font/google";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Parlor — your meetings, remembered",
  description:
    "Parlor joins your meetings, transcribes in real time, and turns every conversation into summaries, action items, and answers you can ask for.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Parlor",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#5c6b4a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
