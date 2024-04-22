module.exports = {
  root: true,
  parserOptions: {
    sourceType: 'module',
  },
  env: {
    es2022: true,
  },
  extends: ['plugin:vue/vue3-essential', '@vue/prettier', '@vue/airbnb', 'plugin:vuejs-accessibility/recommended'],
  rules: {
    // Only allow debugger in development
    'no-debugger': process.env.PRE_COMMIT ? 'error' : 'warn',
    // Only allow `console.log` in development
    'no-console': process.env.PRE_COMMIT
      ? ['error', { allow: ['warn', 'error'] }]
      : ['warn', { allow: ['warn', 'error'] }],

    'max-len': 0,
    // Allow object properties to be reassigned.
    'no-param-reassign': ['error', { props: false }],
    // Disable global-require to allow for dynamic image imports
    'global-require': 'off',
    // Disable underscore dangle restriction
    'no-underscore-dangle': 'off',
    // Disable prefer-destructuring for arrays only
    'prefer-destructuring': ['error', { object: true, array: false }],

    'no-restricted-syntax': ['off', 'ForOfStatement'],
    'no-await-in-loop': 'off',

    // Vue rules (mostly to enforce airbnb in <template>)
    'vue/no-unused-components': process.env.PRE_COMMIT ? 'error' : 'warn',
    'vue/array-bracket-spacing': 'error',
    'vue/arrow-spacing': 'error',
    'vue/block-spacing': 'error',
    'vue/brace-style': 'error',
    'vue/camelcase': 'error',
    'vue/comma-dangle': ['error', 'always-multiline'],
    'vue/component-name-in-template-casing': 'error',
    'vue/dot-location': ['error', 'property'],
    'vue/eqeqeq': 'error',
    'vue/key-spacing': 'error',
    'vue/keyword-spacing': 'error',
    'vue/no-empty-pattern': 'error',
    'vue/no-boolean-default': ['error', 'default-false'],
    'vue/no-irregular-whitespace': 'error',
    'vue/no-reserved-component-names': 'off',
    'vue/no-deprecated-scope-attribute': 'error',
    'vue/object-curly-spacing': ['error', 'always'],
    'vue/padding-line-between-blocks': 'error',
    'vue/space-infix-ops': 'error',
    'vue/space-unary-ops': 'error',
    'vue/v-on-function-call': 'error',
    'vue/v-slot-style': [
      'error',
      {
        atComponent: 'v-slot',
        default: 'v-slot',
        named: 'longform',
      },
    ],
    'vue/valid-v-slot': 'error',
    'vuejs-accessibility/label-has-for': 'off',
    'vuejs-accessibility/click-events-have-key-events': 'off',
    'vuejs-accessibility/anchor-has-content': 'off',
    'vuejs-accessibility/mouse-events-have-key-events': 'off',
    'vuejs-accessibility/no-static-element-interactions': 'off',
    'vue/multi-word-component-names': 'off',
    'no-promise-executor-return': 'off',

    // No way to override these in Prettier, so change Airbnb rules
    'function-paren-newline': 'off',
    'implicit-arrow-linebreak': 'off',
    'no-confusing-arrow': 'off',
    'newline-per-chained-call': 'off',
    'object-curly-newline': 'off',
    'operator-linebreak': [
      'error',
      'after',
      {
        overrides: {
          '?': 'before',
          ':': 'before',
        },
      },
    ],
    'wrap-iife': 'off',
  },
  overrides: [
    {
      files: ['src/**/*', 'tests/unit/**/*', 'tests/e2e/**/*'],
      parserOptions: {

        sourceType: 'module',
      },
      env: {
        browser: true,
      },
    },
  ],
};
