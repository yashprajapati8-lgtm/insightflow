import type { Metadata } from "next";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/source-serif-4";
import "./globals.css";

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "InsightFlow, fix what matters first",
  description:
    "InsightFlow turns customer feedback into ranked, evidence-backed decisions. Every number opens the reviews behind it.",
};

// Sets the theme before the first paint so there is no flash.
const themeScript = `(function(){try{var t=localStorage.getItem('if-theme');if(!t){t='dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
