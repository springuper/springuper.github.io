var fs = require('fs');
var path = require('path');

function findMaxSizeFile(dir, cb) {
  fs.readdir(dir, function (err, files) {
    if (err) return cb(err);
    var counter = files.length;
    var errored = false;
    var stats = [];
 
    files.forEach(function (file, index) {
      fs.stat(path.join(dir,file), function (err, stat) {
        if (errored) return;
        if (err) {
          errored = true;
          return cb(err);
        }
        stats[index] = stat;
 
        if (--counter == 0) {
          var largest = stats
            .filter(function (stat) { return stat.isFile(); }) 
            .reduce(function (prev, next) {
              if (prev.size > next.size) return prev;
              return next;
            })
          cb(null, files[stats.indexOf(largest)]);
        }
      });
    });
  });
};

findMaxSizeFile('./', function (err, file) {
    if (err) {
        console.log('error', err);
    }
    console.log('the max size file is', file);
});
