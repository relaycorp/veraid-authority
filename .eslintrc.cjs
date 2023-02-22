module.exports = {
  extends: ['@relaycorp/eslint-config'],
  root: true,
  rules: {
    "node/no-unpublished-import": "off",
    "import/no-named-as-default": "off",
    "unicorn/prevent-abbreviations": "off",
    "node/no-unsupported-features/es-syntax": "off",
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "default",
        "format": ["strictCamelCase"]
      },
      {
        "selector": "interface",
        "format": ["PascalCase"]
      },
      {
        "selector": "variable",
        "modifiers": ["global"],
        "format": ["strictCamelCase", "UPPER_CASE"]
      },
      {
        "selector": "objectLiteralProperty",
        "format": ["strictCamelCase", "UPPER_CASE"]
      },
      {
        "selector": ["parameter"],
        "format": ["strictCamelCase"],
        "leadingUnderscore": "allow"
      },
      {
        "selector": ["typeLike"],
        "format": ["StrictPascalCase"]
      },
      {
        "selector": ["enumMember"],
        "format": ["UPPER_CASE"]
      },
      {
        "selector": ["variable", "parameter", "accessor"],
        "types": ["boolean"],
        "format": ["PascalCase"],
        "prefix": ["is", "has", "are", "can", "do", "does", "did", "should"]
      }
    ],
  }
};
