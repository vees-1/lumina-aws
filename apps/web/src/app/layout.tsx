import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { Inter, Newsreader } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
  display: 'swap',
});

export const metadata = {
  manifest: "/site.webmanifest?v=l-square-20260905-2",
  icons: {
    icon: [
      { url: "/favicon.ico?v=l-square-20260905-2", type: "image/x-icon", sizes: "16x16 32x32 48x48 64x64" },
      { url: "/lumina-tab-icon.svg?v=l-square-20260905-2", type: "image/svg+xml", sizes: "any" },
      { url: "/icon-32.png?v=l-square-20260905-2", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico?v=l-square-20260905-2",
    apple: [{ url: "/apple-touch-icon.png?v=l-square-20260905-2", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased bg-background text-foreground font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
