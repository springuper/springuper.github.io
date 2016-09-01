var fs = require('fs');
var path = require('path');
var denodeify = require('denodeify');
var fsReaddir = denodeify(fs.readdir);
var fsStat = denodeify(fs.stat);
 
function findMaxSizeFile(dir) {
  return fsReaddir(dir)
    .then(function (files) {
      var promises = files.map(function (file) {
        return fsStat(path.join(dir, file))
      })
      return Promise.all(promises).then(function (stats) {
        return { files: files, stats: stats };
      });
    })
    .then(function (data) {
      var largest = data.stats
        .filter(function (stat) { return stat.isFile(); })
        .reduce(function (prev, next) {
          if (prev.size > next.size) return prev;
          return next;
        });
      return data.files[data.stats.indexOf(largest)]
    });
}

findMaxSizeFile('./')
  .then(function (file) {
    console.log('the max size file is', file);
  })
  .catch(function (error) {
    console.log('error', error);
  });
