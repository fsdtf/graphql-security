module.exports = {
    'displayName': 'unit',
    'rootDir': '.',
    'modulePaths': [
        '<rootDir>/src',
    ],
    'testMatch': [
        '**/?(*.)(spec|test).js?(x)',
    ],
    'modulePathIgnorePatterns': [
        '<rootDir>/node_modules/(?!(fbjs/lib/|react/lib/|fbjs-scripts/jest))',
    ],
    'transform': {
        '^.+\\.jsx?$': 'babel-jest',
    },
    'setupTestFrameworkScriptFile': './jest.setup.js',
    'testResultsProcessor': 'jest-junit-reporter',
    'collectCoverage': true,
    'coveragePathIgnorePatterns': [
        '/node_modules/',
        '<rootDir>/package.json',
        '<rootDir>/jest/',
        '<rootDir>/src/__tests__/resources/',
        '<rootDir>/src/__tests__/*',
    ],
    'coverageDirectory': './dist/coverage/',
    'cacheDirectory': './tmp/jest-cache/',
    'globals': {
        '__DEV__': true,
        '__PROD__': false,
        '__VERSION__': require('./package.json').version,
    },
}
