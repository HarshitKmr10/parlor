module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'next/core-web-vitals'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: true,
    tsconfigRootDir: __dirname
  },
  plugins: [
    '@typescript-eslint/eslint-plugin',
    'react',
    'react-hooks',
    'simple-import-sort',
    'jsx-expressions'
  ],
  rules: {
    // Add any custom rules or overrides here
    'import/prefer-default-export': 'off',
    'global-require': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'react-hooks/exhaustive-deps': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-await-in-loop': 'off',
    'no-console': 'off',
    'no-restricted-syntax': 'off',
    'jsx-a11y/control-has-associated-label': 'off',
    'react/no-danger': 'off',
    'jsx-a11y/heading-has-content': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'react/require-default-props': 'off',
    'react/no-unstable-nested-components': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/button-has-type': 'off',
    'react/no-array-index-key': 'off',
    'consistent-return': 'off',
    'no-nested-ternary': 'off',
    'max-len': 'off',
    '@typescript-eslint/no-throw-literal': 'off',
    'react/jsx-closing-tag-location': 'off',
    'react/no-unescaped-entities': 'off',
    '@typescript-eslint/no-shadow': 'off',
    'react/display-name': 'off',
    '@typescript-eslint/default-param-last': 'off',
    'react/destructuring-assignment': 'off',
    'no-tabs': 'off',
    'react/jsx-indent': 'off',
    'react/function-component-definition': 'off',
    'no-alert': 'off',
    'no-mixed-operators': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'implicit-arrow-linebreak': 'off',
    'no-plusplus': 'off',
    'prefer-destructuring': 'off',
    'simple-import-sort/exports': ['off'],
    'simple-import-sort/imports': ['off'],
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    'import/no-unresolved': 'off',
    '@typescript-eslint/no-unused-vars': 'off',

    // enable warning for following rules
    'no-dupe-keys': 'warn',

    // enable error for following rules
    eqeqeq: 'error',
    'jsx-expressions/strict-logical-expressions': 'error',
    semi: 'error'
  },
  overrides: [
    {
      files: ['*.jsx', '*.ts', '*.tsx'],
      excludedFiles: ['tailwind.config.js', 'postcss.config.js', '.prettierrc.js', '.eslintrc.js'],
      rules: {
        'global-require': 'error'
      }
    }
  ]
};