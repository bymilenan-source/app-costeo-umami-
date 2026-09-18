import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Costeo UMAMI",
    short_name: "Costeo UMAMI",
    description: "Costeo, recetas y facturación para pasteleras y pequeños emprendimientos de comida.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F8F3EA",
    theme_color: "#1B2A4A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
