module.exports = {
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        '@stylistic/ts',
    ],
    root: true,
    rules: {
        '@stylistic/ts/semi': ['error', 'always'],
        '@stylistic/ts/quotes': ['error', 'single'],
        '@stylistic/ts/comma-dangle': ['error', 'always-multiline'],
    },
};