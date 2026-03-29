import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import AuthProvider from "@/components/auth-provider";
import PlayfulAlert from "@/components/playful-alert";

export const viewport: Viewport = {
  themeColor: "#fdfbf7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://nest-splitbill-app.vercel.app"),
  title: "nest — split expenses easily",
  description: "a cozy expense splitter for trips with friends.",
  keywords: ["bill splitter", "travel expenses", "nest"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "nest",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "nest. — split expenses easily",
    description: "split expenses, keep the peace 🌱",
    url: "https://nest-splitbill-app.vercel.app",
    siteName: "nest.",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "nest logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#fdfbf7] text-stone-800">
        <AuthProvider>
          {children}
          <PlayfulAlert /> {/* <-- mount it here right under children */}
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
