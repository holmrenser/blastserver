import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// Next 16's eslint-config-next ships native flat config, so we consume it
// directly instead of bridging the legacy shareable config through FlatCompat.
// The base config already registers the @typescript-eslint plugin + parser for
// TS files, so we only layer our custom unused-vars rule on top.
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "worker/build/**",
      "data/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
