#!/bin/bash -e

cd blog
npx hexo generate
cd ..
cp -r blog/public/* docs/
