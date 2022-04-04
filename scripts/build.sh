#!/bin/bash -e

cd blog
cp themes/_config.yml themes/even/
cp themes/_custom.scss themes/even/source/css/_custom/
npx hexo generate
cd ..
cp -r blog/public/* docs/
cp favicon.ico docs/
