#!/usr/bin/env sh

# 确保脚本抛出遇到的错误
set -e

# 生成静态文件
# pnpm build

# 进入生成的文件夹
cd dist

git init
git add -A
git commit -m 'deploy'

# 发布到 https://<USERNAME>.github.io/<REPO>
git push -f  git@github.com:quarksb/GraphWaGu.git master:gh-pages

cd -