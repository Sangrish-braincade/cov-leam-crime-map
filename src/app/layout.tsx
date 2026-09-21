import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const display = Schibsted_Grotesk({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

const DESCRIPTION =
  "Three years of police.uk street-level crime for Coventry, Leamington Spa, Warwick and Kenilworth, mapped for students. Search your street, read plain-English guides, and follow local crime news.";

export const metadata: Metadata = {
  metadataBase: new URL("https://covcrimeinfo.warwickly.com"),
  title: "Cov & Leam Crime Map",
  description: DESCRIPTION,
  applicationName: "Cov & Leam Crime Map",
  creator: "Warwickly",
  publisher: "Warwickly",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Warwickly",
    title: "Cov & Leam Crime Map",
    description: DESCRIPTION,
    locale: "en_GB",
  },
  twitter: { card: "summary", title: "Cov & Leam Crime Map", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e12" },
  ],
};

// Apply a saved theme before first paint so the page never flashes the wrong one.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
