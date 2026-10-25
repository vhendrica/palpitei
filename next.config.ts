import type { NextConfig } from "next";

// No GitHub Pages o site vira estático e mora em /<repositório>.
const basePath = process.env.PAGES_BASE_PATH ?? "";
const staticExport = basePath !== "";

const nextConfig: NextConfig = {
  // PPR não funciona no export estático.
  cacheComponents: !staticExport,
  partialPrefetching: !staticExport,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(staticExport
    ? { output: "export", basePath, trailingSlash: true }
    : {
        // O app Palpitei (export web do Expo) fica em public/app como SPA.
        async rewrites() {
          return {
            beforeFiles: [],
            afterFiles: [
              { source: "/app/:path*", destination: "/app/index.html" },
            ],
            fallback: [],
          };
        },
      }),
};

export default nextConfig;
