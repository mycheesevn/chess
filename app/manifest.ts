import { ICON_VERSION } from "@/lib/chess/iconSvg";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chess vs Computer",
    short_name: "Chess",
    description:
      "Play international chess against the computer with 10 difficulty levels. Free online chess in English and Vietnamese.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#101418",
    theme_color: "#101418",
    icons: [
      {
        src: `/icon.svg?v=${ICON_VERSION}`,
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: `/pwa/icon-192.png?v=${ICON_VERSION}`,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: `/pwa/icon-512.png?v=${ICON_VERSION}`,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: `/pwa/icon-maskable.png?v=${ICON_VERSION}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
