// UI-KIT-1 lint (docs/design/ui-kit.md). TypeScript 7 (the native port) has no JS compiler API, so typescript-eslint
// cannot run; @babel/eslint-parser reads the TS and JSX syntax instead (no type information: the rules here need none).
import babelParser from "@babel/eslint-parser";
import reactHooks from "eslint-plugin-react-hooks";

const NATIVE_CONTROL = (tag, part) => ({
  selector: `JSXOpeningElement[name.name='${tag}']`,
  message: `UI-KIT-1: no native <${tag}> in the screens — use the kit's ${part} (src/ui/kit). Only the kit renders host controls.`,
});

export default [
  { ignores: ["dist/**", "node_modules/**", "output/**", "public/**", "coverage/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: babelParser,
      sourceType: "module",
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", "jsx"] } },
      },
    },
    plugins: { "react-hooks": reactHooks },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    // The screens: every button, select, input and text field is a kit part.
    files: ["src/ui/**/*.tsx", "src/App.tsx", "src/render/**/*.tsx"],
    ignores: ["src/ui/kit/**"],
    rules: {
      "no-restricted-syntax": ["error",
        NATIVE_CONTROL("button", "Button / IconButton / Toggle / Tabs"),
        NATIVE_CONTROL("select", "Select"),
        NATIVE_CONTROL("input", "Slider / Toggle / Checkbox"),
        NATIVE_CONTROL("textarea", "parts"),
      ],
    },
  },
];
