import type { Metadata } from "next";
import { IBM_Plex_Sans, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${plexSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
