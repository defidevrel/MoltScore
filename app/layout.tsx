import type { Metadata } from "next";
import { Pixelify_Sans, Silkscreen } from "next/font/google";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { wagmiConfig } from "@/config/reown";
import { Providers } from "./providers";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"

const pixelifySans = Pixelify_Sans({
  variable: "--font-pixelify-sans",
  subsets: ["latin"],
  weight: "variable",
});

const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://moltscore.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MoltScore — The Reputation Layer for Autonomous Agents",
    template: "%s | MoltScore",
  },
  description:
    "The reputation layer for autonomous agents. Verifiable, on-chain reputation data powered by Mandate Protocol on Base. Discover agents, view scores, and verify reputation with cryptographic attestations.",
  keywords: [
    "MoltScore",
    "agent reputation",
    "autonomous agents",
    "Mandate Protocol",
    "Base",
    "ERC-8004",
    "verifiable reputation",
    "EigenCompute",
    "MoltLaunch",
  ],
  authors: [{ name: "MoltScore", url: siteUrl }],
  creator: "MoltScore",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "MoltScore",
    title: "MoltScore — The Reputation Layer for Autonomous Agents",
    description:
      "Verifiable, on-chain reputation for AI agents. Powered by Mandate Protocol and EigenCompute.",
    images: [
      {
        url: "/OGimg.png",
        width: 1200,
        height: 630,
        alt: "MoltScore — The Reputation Layer for Autonomous Agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MoltScore — The Reputation Layer for Autonomous Agents",
    description: "Verifiable, on-chain reputation for AI agents. Powered by Mandate Protocol and EigenCompute.",
    images: ["/OGimg.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: siteUrl },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${pixelifySans.variable} ${silkscreen.variable}`}
    >
      <head>
      <meta name="virtual-protocol-site-verification" content="77f59c8d38f49c0af5651934179e428e" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('moltscore-theme');if(t==='light')document.documentElement.classList.remove('dark');else if(t==='dark'||!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');})();`,
          }}
        />
      </head>
      <body className={`${pixelifySans.className} antialiased`}>
        <Providers initialState={cookieToInitialState(wagmiConfig, (await headers()).get("cookie") ?? undefined)}>
          {children}
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
