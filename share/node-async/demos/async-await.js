'use strict';

const fs = require('fs');
const path = require('path');
const denodeify = require('denodeify');
const fsReaddir = denodeify(fs.readdir);
const fsStat = denodeify(fs.stat);
 
const findMaxSizeFile = async dir => {
  const files = await fsReaddir(dir);
  const stats = [];
  for (const file of files) {
    const stat = await fsStat(path.join(dir, file));
    stats.push({ file: file, stat: stat });
  }
  const largest = stats
    .filter(stat => stat.stat.isFile())
    .reduce((prev, next) => {
      if (prev.stat.size > next.stat.size) return prev;
      return next;
    });
  return largest.file;
};

findMaxSizeFile('./')
  .then(function (file) {
    console.log('the max size file is', file);
  })
  .catch(function (error) {
    console.log('error', error);
  });
