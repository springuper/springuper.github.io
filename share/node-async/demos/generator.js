var fs = require('fs');
var path = require('path');
var co = require('co');
var thunkify = require('thunkify');
var readdir = thunkify(fs.readdir);
var stat = thunkify(fs.stat);
 
function findMaxSizeFile(dir) {
  return co(function* () {
    var files = yield readdir(dir);
    var stats = yield files.map(function (file) {
      return stat(path.join(dir, file));
    });
    var largest = stats
      .filter(function (stat) { return stat.isFile(); })
      .reduce(function (prev, next) {
        if (prev.size > next.size) return prev;
        return next;
      });
    return files[stats.indexOf(largest)];
  });
}

findMaxSizeFile('./')
  .then(function (file) {
    console.log('the max size file is', file);
  })
  .catch(function (error) {
    console.log('error', error);
  });
