import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { IBM_Plex_Sans, Sora } from "next/font/google";
import { FirebaseAnalyticsLoader } from "@/components/firebase-analytics-loader";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { MobileInstallBanner } from "@/components/mobile/mobile-install-banner";
import { WebVitalsReporter } from "@/components/performance/web-vitals";
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
        <a
          href="#main-content"
          className="sr-only absolute left-3 top-3 z-[400] rounded-full bg-white px-4 py-2 text-sm font-medium text-ink shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-teal/35"
        >
          Skip to content
        </a>
        <FirebaseAnalyticsLoader />
        <Suspense fallback={null}>
          <WebVitalsReporter />
        </Suspense>
        <Suspense fallback={null}>
          <PwaClient />
        </Suspense>
        <Suspense fallback={null}>
          <MobileInstallBanner />
        </Suspense>
        <div id="main-content" className="contents">
          {children}
        </div>
        <Suspense fallback={null}>
          <MobileBottomNav />
        </Suspense>
      </body>
    </html>
  );
}
