# Playwright MCP：给 Windows 上的 Harness

只需要两个包，页面操作交给 Harness。

1. **Extension**：[微软官方商店](https://chromewebstore.google.com/detail/mmlmfjhmonkocbjadbfplnigmagldckm)；商店无法访问时用 [已导出 ZIP](https://raw.githubusercontent.com/stevejoeyms/ds_tmp/main/playwright-extension-0.5.0.zip)，解压后在 `chrome://extensions/` 的开发者模式中加载。
2. **Server**：[下载 Windows 离线 ZIP](https://github.com/stevejoeyms/ds_tmp/releases)。选择 `playwright-mcp-offline-win-x64.zip`，不是 Source code。包含微软官方 MCP 0.0.85 及完整依赖，无需 npm 或独立 Node。

Server 解压后，在沙箱外普通 PowerShell 中进入该文件夹运行：

```powershell
.\start-mcp.ps1
```

脚本自动使用 DSH 自带 Node 24 x64，以 Extension 模式监听 `http://127.0.0.1:8931/mcp`。保留窗口，Ctrl+C 停止。不修改企业策略或 DSH 运行时。

把下面这段交给 Windows 上的 Harness：

> 请读取离线包内 README.md，使用我已有的 MCP Manager 将 Playwright 注册为 streamable-http，URL 为 http://127.0.0.1:8931/mcp。保留其他已有 MCP 配置，不重复安装 Client，不扩大沙箱权限。如果无法自动注册，请只告诉我必须手动填写的字段。注册成功后调用 browser_tabs 和 browser_snapshot，读取我选定的 Chrome 页面；我会在官方 Extension 中确认连接。后续按我的自然语言指令调用 browser_click 等工具操作，未经我批准不要新增、删除、保存或提交业务数据。

首次浏览器连接需你在扩展中批准。Chrome 中自行完成企业登录。端口或脚本若被策略阻止，交由公司 IT 按批准流程处理。

[完整说明与官方参考](https://github.com/stevejoeyms/ds_tmp/blob/main/offline-mcp/README.md)

构建检查只覆盖 Windows 包运行、服务启动及 MCP 初始化和工具枚举；本机不是目标 Windows，真实 Harness 接管尚未实测。
