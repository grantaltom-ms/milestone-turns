import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { getCurrentProfile } from "@/lib/current-user";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Unit Turns — Milestone Properties",
  description: "Track vacant apartment units through the make-ready pipeline.",
  // The app renders its own translations; stop the browser (Chrome Translate)
  // from re-translating a Spanish page into a broken English/Spanish hybrid.
  other: { google: "notranslate" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1A2E44",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Declare the real content language so the browser doesn't auto-translate a
  // Spanish page (which produced a broken English/Spanish hybrid on reload).
  const profile = await getCurrentProfile();
  const lang = profile?.language ?? "en";
  return (
    <html lang={lang} translate="no" className={`notranslate ${dmSans.variable} ${playfair.variable}`}>
      <body>
        <div id="app-frame">{children}</div>
      </body>
    </html>
  );
}
