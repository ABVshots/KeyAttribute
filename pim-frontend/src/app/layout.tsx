import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "KeyFeatures",
    template: "%s • KeyFeatures",
  },
  applicationName: "KeyFeatures",
  description: "KeyFeatures — довідники та BOM-структури",
  openGraph: {
    title: "KeyFeatures",
    description: "KeyFeatures — довідники та BOM-структури",
    siteName: "KeyFeatures",
  },
};

function ThemeScript() {
  const js = `
(function(){
  try {
    var cookieMatch = document.cookie.match(/(?:^|; )theme=([^;]+)/);
    var cookieTheme = cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';
    var theme = cookieTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var html = document.documentElement;
    if (!html.getAttribute('data-theme') || html.getAttribute('data-theme') !== theme) {
      html.setAttribute('data-theme', theme);
    }
  } catch {}
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const WebVitalsMount = require('./WebVitalsMount').default;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <WebVitalsMount />
      </body>
    </html>
  );
}
