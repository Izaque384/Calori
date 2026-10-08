import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Calori — a experiência digital do seu restaurante",
    short_name: "Calori",
    description: "Cardápio digital, pedidos, mesas e atendimento para restaurantes.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F8F1EA",
    theme_color: "#C65A3A",
    orientation: "any",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
