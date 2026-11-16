# Playwright Extension 0.5.0 离线安装包

从本机 Chrome 已安装的扩展导出。扩展 ID：`mmlmfjhmonkocbjadbfplnigmagldckm`，Manifest V3。

## 在另一台电脑安装

1. 下载 `playwright-extension-0.5.0.zip` 并解压到一个长期保留的目录。
2. 在 Chrome 地址栏打开 `chrome://extensions/`。
3. 开启右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择解压后的 `playwright-extension-0.5.0` 文件夹（其中直接包含 `manifest.json`）。
5. 确认扩展列表显示 **Playwright Extension 0.5.0**。
6. 按目标电脑上的 Playwright MCP / CLI 配置连接浏览器；连接所需令牌请使用目标电脑上的值。

不要将 ZIP 直接拖入 Chrome 安装，也不要在安装后删除或移动解压目录。受组织管理的 Chrome 可能由管理员限制加载扩展。

## 包内容与来源

- 包含扩展运行文件；保留原始 `manifest.json`、公共扩展 key 及代码版权声明。
- 排除 Chrome 商店安装校验目录 `_metadata`，方便以已解压方式加载。
- 不含浏览器用户资料、Cookie、网站登录状态、扩展本地存储或本机连接令牌。
- `lib/ui/authToken.js` 是扩展自带的界面程序文件，不是本机令牌数据。
- 代码未修改，随包附 Microsoft Playwright 的 Apache 2.0 LICENSE。
- 商店页面：https://chromewebstore.google.com/detail/mmlmfjhmonkocbjadbfplnigmagldckm
- 上游：https://github.com/microsoft/playwright-mcp

## 验证

已核对 ZIP 完整性、所有导出运行文件与原文件字节一致、Manifest 引用的后台脚本及图标存在，并验证保留的公共 key 对应上述扩展 ID。未在另一台电脑实际安装或验证 MCP / CLI 连接。

`SHA256SUMS` 可用于校验 ZIP 下载内容。
