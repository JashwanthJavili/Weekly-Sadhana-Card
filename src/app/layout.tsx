import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no Google Fonts request at build or run time).
import "@fontsource/fraunces/latin-400.css";
import "@fontsource/fraunces/latin-700.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "./globals.css";
import { AccountProvider } from "@/components/AccountProvider";
import { UpdateGuard } from "@/components/UpdateGuard";

export const metadata: Metadata = {
  title: "Youth Sadhana Card",
  description: "Fill in your weekly Sadhana Card, save it and download it as PDF.",
};

export const viewport: Viewport = {
  themeColor: "#008080",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <UpdateGuard />
        <AccountProvider>{children}</AccountProvider>
      </body>
    </html>
  );
}
