import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/components/chess/AuthProvider";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const metadata: Metadata = {
  title: "Chess vs Computer — Play Chess Online Free",
  description:
    "Play international chess against the computer with 10 difficulty levels. Free online chess game in English and Vietnamese. Chơi cờ vua miễn phí với máy.",
  keywords: ["chess", "cờ vua", "play chess online", "chess vs computer", "free chess"],
  openGraph: {
    title: "Chess vs Computer",
    description: "Play international chess against the computer. 10 levels, EN/VI.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {GA_ID && (
          <>
            {/* Google tag (gtag.js) — Google Analytics */}
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ("serviceWorker" in navigator) {
              window.addEventListener("load", function () {
                navigator.serviceWorker.register("/sw.js").catch(function () {});
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
