import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./design-tokens.css";
import "./styles.css";
import { AuthProvider } from "./providers/auth-provider";

export const metadata: Metadata = {
  title: "EaziCart — Commerce in motion",
  description: "Discover products, connect with sellers, and shop with ease.",
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
