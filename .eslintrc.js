module.exports = {
    'env': {
        'commonjs': true,
        'es6': true,
        'node': true
    },
    'extends': [
      'eslint:recommended',
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended'
    ],
    'globals': {
        'Atomics': 'readonly',
        'SharedArrayBuffer': 'readonly'
    },
    'parser': '@typescript-eslint/parser',
    'parserOptions': {
        'ecmaVersion': 2018
    },
    'plugins': [
      '@typescript-eslint'
    ],
    'root': true,
    'rules': {
        'indent': [
            'error',
            2
        ],
        'linebreak-style': [
            'error',
            'windows'
        ],
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'always'
        ],
        'no-console': 'off',
        'no-unused-vars': [
          'error',
          {
            'varsIgnorePattern': '_*',
            'argsIgnorePattern': '_*'
          }
        ],
        'no-extra-semi': 0,
        '@typescript-eslint/no-namespace': 'off'
    }
};
