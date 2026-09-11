import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { ToastProvider } from "@/components/feedback/toast-provider";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "RepoDeck — command deck for GitHub", template: "%s · RepoDeck" },
  description: "Self-hosted command deck for GitHub: review-grade diffs, deep repository analytics, secret scanning, issues, pull requests, and safe ZIP imports — no git CLI required."
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "dark light", themeColor: "#050506" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <html lang="en" data-theme="dark" suppressHydrationWarning>
    <head><script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }}/></head>
    <body><ToastProvider>{children}</ToastProvider></body>
  </html>;
}
