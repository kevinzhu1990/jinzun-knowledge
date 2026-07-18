# 金尊知识库 Windows 桌面应用

## 打包

```powershell
npm install
npm run build:win
```

安装包生成在 `desktop/release/`。

## 更新方式

桌面应用每次启动都会打开金尊知识库线上最新版，并清理资源缓存。题库、管理后台和页面功能更新后，员工无需重新安装 EXE。

如果修改 Electron 桌面外壳本身，需提升 `desktop/package.json` 版本号并重新生成安装包。

## 网络说明

员工登录、题库更新、考试提交和飞书同步仍需访问 `https://jinzun-knowledge.vercel.app/`。EXE 安装形式不会改变网络可达性。
