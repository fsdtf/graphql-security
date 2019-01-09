const path = require('path')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')
const absPath = dir => path.join(__dirname, dir)

const PKG = require('./package.json')
const DEV = process.env.NODE_ENV !== 'production'

module.exports = {
    target: 'node',
    devtool: 'source-map',
    watch: DEV,
    mode: DEV ? 'development' : 'production',
    node: {
        __dirname: false,
        __filename: false,
    },
    entry: {
        'index': absPath(`./src/index.js`),
    },
    resolve: {
        modules: [
            absPath('./src'),
            'node_modules',
        ],
    },
    output: {
        path: absPath(`./dist`),
        filename: '[name].js',
        libraryTarget: 'commonjs2',
        pathinfo: true,
    },
    module: {
        rules: [
            {
                test: /\.(jsx?)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: { cacheDirectory: './tmp/babel_cache/node' },
                },
            },
        ],
    },
    externals: [
        nodeExternals(),
    ],
    plugins: [
        new webpack.DefinePlugin({
            __DEV__: JSON.stringify(DEV),
            __PRODUCTION__: JSON.stringify(!DEV),
            __VERSION__: JSON.stringify(PKG.version),
        }),
        ...DEV ? [ new webpack.NamedModulesPlugin() ] : [],
    ],
}
