import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Sora } from "next/font/google";
import { FirebaseAnalyticsLoader } from "@/components/firebase-analytics-loader";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { MobileInstallBanner } from "@/components/mobile/mobile-install-banner";
import { PwaClient } from "@/components/pwa/pwa-client";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: {
    default: "Classify",
    template: "%s | Classify",
  },
  applicationName: "Classify",
  description:
    "Professor and course intelligence with grade outcomes, trend data, universal search, and transparent coverage tiers.",
  keywords: [
    "college professor search",
    "grade distributions",
    "college course data",
    "Rate My Professors alternative",
    "Classify",
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Classify",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08192c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${sora.variable} ${plexSans.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <FirebaseAnalyticsLoader />
        <PwaClient />
        <MobileInstallBanner />
        {children}
        <MobileBottomNav />
      </body>
    </html>
  );
}
