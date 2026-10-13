import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Site 100% estático: nada é processado em servidor, então basta publicar a pasta `out`.
  output: "export",
  // `/rota/` -> `rota/index.html`: funciona em qualquer host estático, sem regras de rewrite.
  trailingSlash: true,
  // `cacheComponents` (PPR) exige servidor Node e é incompatível com `output: "export"`;
  // o app não usa `use cache`, então não há nada a perder desligando.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
