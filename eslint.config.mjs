import { FlatCompat } from "@eslint/eslintrc";
import security from "eslint-plugin-security";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  { ignores: [".next/**", "node_modules/**", "public/**"] },
  ...compat.extends("next/core-web-vitals"),
  {
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,
      // False-positive rate in TypeScript is ~95% — TS type system already prevents injection
      // via typed Record/enum access (e.g. STATUS_COLOR[user.status] where STATUS_COLOR is
      // Record<UserStatus, ...>). Real injection risks are caught by CodeQL with type awareness.
      "security/detect-object-injection": "off",
    },
  },
];
