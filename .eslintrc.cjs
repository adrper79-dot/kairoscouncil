/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
  ],
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/explicit-function-return-type": [
      "warn",
      { allowExpressions: true },
    ],
  },
  overrides: [
    {
      // Ban Math.random() in game-engine and astronomical-engine — AC-003
      files: [
        "packages/astronomical-engine/**/*.ts",
        "packages/game-engine/**/*.ts",
      ],
      rules: {
        // Ban only Math.random() — Math.floor/min/max/imul etc. are allowed.
        // no-restricted-globals would ban the whole Math object, which is wrong.
        "no-restricted-properties": [
          "error",
          {
            object: "Math",
            property: "random",
            message:
              "Math.random() is banned in game logic (AC-003). Use the deterministic seed system.",
          },
        ],
      },
    },
  ],
  ignorePatterns: ["dist/", "node_modules/", "*.js", "*.cjs"],
};
