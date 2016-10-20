const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const DumpPlugin = require('./dumpPlugin');

const src = path.join(__dirname, '/components');
const dest = path.join(__dirname, "/dest");

module.exports = {
  context: src,
  entry: {
    app: path.join(src, 'App/App.js')
  },
  output: {
    path: dest,
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        include: src,
        loader: 'babel',
        query: {
          presets: ['es2015', 'react']
        }
      },
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract(
          'style?sourceMap',
          [
            'css?modules&importLoaders=1&localIdentName=[local]_[hash:base64:5]',
          ]
        )
      }
    ]
  },
  plugins: [
    new ExtractTextPlugin('styles.css'),
    // new DumpPlugin()
  ]
};
