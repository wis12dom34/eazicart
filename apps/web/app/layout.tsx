import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { brandDescription, siteOrigin } from "../lib/seo";

import "./styles.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { AuthProvider } from "./providers/auth-provider";

export const metadata: Metadata = {
  metadataBase: siteOrigin() ? new URL(siteOrigin()!) : undefined,
  title: {
    default: "EaziCart | The Operating System for Modern Businesses",
    template: "%s | EaziCart",
  },
  description: brandDescription,
  applicationName: "EaziCart",
  robots: { index: false, follow: true },
  openGraph: {
    title: "EaziCart | The Operating System for Modern Businesses",
    description: brandDescription,
    siteName: "EaziCart",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "EaziCart",
    description: brandDescription,
  },
  icons: { icon: "/figma/logo.svg" },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
