function DumpPlugin() {
}

DumpPlugin.prototype.apply = function(compiler) {
  // compiler.plugin('emit', function(compilation, callback) {
  //   console.log('emit', compilation);
  //   callback();

  //   // var changedFiles = Object.keys(compilation.fileTimestamps).filter(function(watchfile) {
  //   //   return (this.prevTimestamps[watchfile] || this.startTime) < (compilation.fileTimestamps[watchfile] || Infinity);
  //   // }.bind(this));

  //   // this.prevTimestamps = compilation.fileTimestamps;
  // }.bind(this));
  compiler.plugin("compilation", function(compilation) {
    compilation.plugin('normal-module-loader', function(loaderContext, module) {
      //this is where all the modules are loaded
      //one by one, no dependencies are created yet
      // console.log('===== normal-module-loader loaderContext:', Object.keys(loaderContext));
      console.log('===== normal-module-loader module:', module.dependencies, module.id, module.index);
    });
  });
};

module.exports = DumpPlugin;
