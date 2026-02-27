const ci = require('miniprogram-ci');
const path = require('path');
const fs = require('fs');

const PROJECT_PATH = path.resolve(__dirname, '../miniprogram');
const KEY_PATH = path.resolve(PROJECT_PATH, 'private.wxcfc396f91fa46d03.key');

async function main() {
  const project = new ci.Project({
    appid: 'wxcfc396f91fa46d03',
    type: 'miniGame',
    projectPath: PROJECT_PATH,
    privateKeyPath: KEY_PATH,
    ignores: ['node_modules/**/*', 'cloudfunctions/**/*', 'private.*.key'],
  });

  console.log('开始上传到微信后台...');
  const uploadResult = await ci.upload({
    project,
    version: '1.0.0',
    desc: '斗地主小游戏 v1.0.0 首次上传',
    setting: {
      es6: true,
      minify: true,
    },
    onProgressUpdate: (task) => {
      if (task && task._status) {
        console.log(`进度: ${task._status}`);
      }
    },
  });

  console.log('上传成功！');
  console.log(JSON.stringify(uploadResult, null, 2));
}

main().catch((err) => {
  console.error('上传失败:', err.message || err);
  process.exit(1);
});
