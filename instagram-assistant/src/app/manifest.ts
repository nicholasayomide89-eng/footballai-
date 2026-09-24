import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Keel",
    short_name: "Keel",
    description: "Your Instagram assistant",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#f6f4ef",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
