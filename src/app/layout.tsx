import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegistrar } from "@/components/pwa/sw-registrar";
import { RippleLayer, ScrollProgress } from "@/components/ui/effects";
import { t } from "@/lib/i18n/sr";

export const metadata: Metadata = {
  title: { default: t.app.name, template: `%s · ${t.app.name}` },
  description: t.app.tagline,
  applicationName: t.app.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: t.app.name, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f2f0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr-Latn">
      <body className="min-h-dvh">
        <a href="#sadrzaj" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
          {t.nav.skipToContent}
        </a>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistrar />
        <RippleLayer />
        <ScrollProgress />
      </body>
    </html>
  );
}
