import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["600", "700", "800"],
  display: "swap",
});
const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const SITE_DESC =
  "Track and discover progression fantasy and litRPG. Filter by trope, system, and rank, with ratings aggregated from Royal Road and Goodreads.";

export const metadata: Metadata = {
  metadataBase: new URL("https://progfans.com"),
  title: "ProgFans — discover progression fantasy & litRPG",
  description: SITE_DESC,
  applicationName: "ProgFans",
  openGraph: {
    type: "website",
    siteName: "ProgFans",
    locale: "en_US",
    url: "https://progfans.com",
    title: "ProgFans — discover progression fantasy & litRPG",
    description: SITE_DESC,
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const dark = (await cookies()).get("theme")?.value === "dark";
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} ${dark ? "dark" : ""}`}
    >
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
