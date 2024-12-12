#!/usr/bin/env sh

# 确保脚本抛出遇到的错误
set -e

# 生成静态文件
# pnpm build

# 进入生成的文件夹
cd dist

git init
if ! git remote | grep -q 'origin'; then
    git remote add origin git@github.com:harp-lab/GraphWaGu.git
fi
git pull
git checkout gh-pages
git add -A
git commit -m 'deploy'

# 发布到 https://<USERNAME>.github.io/<REPO>
git push -f

cd -