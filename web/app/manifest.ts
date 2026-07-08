import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Parlor — your meetings, remembered",
    short_name: "Parlor",
    description:
      "Parlor joins your meetings, transcribes in real time, and turns every conversation into summaries, action items, and answers you can ask for.",
    start_url: "/",
    display: "standalone",
    background_color: "#fcfbf7",
    theme_color: "#5c6b4a",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
