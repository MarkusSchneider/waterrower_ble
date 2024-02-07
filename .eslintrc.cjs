module.exports = {
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/stylistic',
    ],
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        '@stylistic/ts',
    ],
    root: true,
    rules: {
        '@stylistic/ts/brace-style': ['error'],
        '@stylistic/ts/comma-dangle': ['error', 'always-multiline'],
        '@stylistic/ts/quotes': ['error', 'single'],
        '@stylistic/ts/semi': ['error', 'always'],
        '@typescript-eslint/array-type': ['error', { default: 'generic' }],
        '@typescript-eslint/no-inferrable-types': 'off',
    },
};