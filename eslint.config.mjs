import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/drizzle/**",
      "**/.husky/**",
      "**/*.config.{js,mjs,cjs,ts}",
      "**/next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // The Next.js plugin lives in apps/web; point it there from the monorepo root.
    settings: { next: { rootDir: "apps/web/" } },
  },
];
