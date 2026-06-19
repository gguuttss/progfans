import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private / no-SEO-value routes.
      disallow: ["/admin", "/api/", "/welcome", "/login", "/signup"],
    },
    sitemap: "https://progfans.com/sitemap.xml",
    host: "https://progfans.com",
  };
}
