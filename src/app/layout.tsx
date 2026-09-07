import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/feedback/toast-provider";

export const metadata: Metadata = {
  title: { default: "ZipToGit Pro", template: "%s · ZipToGit Pro" },
  description: "Import a ZIP into GitHub safely and manage the repository from one focused workspace."
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "dark light", themeColor: "#0b0d12" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ToastProvider>{children}</ToastProvider></body></html>;
}
