import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JARVIS",
    short_name: "JARVIS",
    description: "Personal AI operating system and dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#06080e",
    theme_color: "#06080e",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
