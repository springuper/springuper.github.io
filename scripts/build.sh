#!/bin/bash -e

cd blog
cp themes/_config.yml themes/even/
npx hexo generate
cd ..
cp -r blog/public/* docs/
cp favicon.ico docs/
