# Playwright MCP：Windows 离线最小安装

目标：DSH 用自然语言调用 Playwright，控制 Chrome 现有登录会话。

组合只有三件：**DSH 已有 MCP Manager/Client → 官方 Playwright MCP → 官方 Playwright Extension**。
本包固定 `@playwright/mcp@0.0.85`，包含完整生产 `node_modules`。不含 Node、npm、浏览器二进制或浏览器登录数据。目标电脑不需安装任何 npm 包。

## 1. 下载并解压

从本仓库 Releases 下载 `playwright-mcp-offline-win-x64.zip` 和同名 `.sha256`，不要下载 GitHub 的 Source code ZIP。后者不含依赖。

可先在普通 PowerShell 核对 SHA256（与 `.sha256` 中的值相同）：

```powershell
Get-FileHash "$env:USERPROFILE\Downloads\playwright-mcp-offline-win-x64.zip" -Algorithm SHA256
```

解压到自己的工作目录（路径有空格也支持）。以下以解压后文件夹为例：

```powershell
Set-Location 'C:\path\to\playwright-mcp-offline-win-x64'
```

## 2. Chrome 装官方扩展，启动服务

优先安装 [Microsoft 官方 Playwright Extension](https://chromewebstore.google.com/detail/mmlmfjhmonkocbjadbfplnigmagldckm)。商店不可访问时，可用本仓库先前导出的 [扩展 0.5.0 ZIP](https://raw.githubusercontent.com/stevejoeyms/ds_tmp/main/playwright-extension-0.5.0.zip)：解压，打开 `chrome://extensions/`，开启开发者模式，加载已解压文件夹。若企业策略禁止安装，交由 IT 批准，不改策略。

保持 Chrome 正常运行，用户自行登录目标页面。在 **DSH 沙箱外的普通 PowerShell** 中运行：

```powershell
.\start-mcp.ps1
```

脚本在 `%USERPROFILE%\.dsh\dsh-runtimes\` 下自动查找现有 Node 24 x64，只读使用，不修改 DSH 运行时。不需要管理员权限。

若找不到，指定 DSH 实际自带的 `node.exe`，不要另行安装：

```powershell
.\start-mcp.ps1 -NodePath 'C:\actual\dsh-runtime\node.exe'
```

它实际运行：

```text
<DSH node.exe> node_modules/@playwright/mcp/cli.js --extension --browser=chrome --port=8931 --host=127.0.0.1
```

保留 PowerShell 窗口。后续首次调用浏览器工具时，按 Chrome 扩展界面批准连接/选择标签页。停止服务：在此窗口按 **Ctrl+C**。不关闭浏览器，不注销登录。

如果 PowerShell 被企业执行策略拦截，不用 Bypass、不更改策略；按公司批准的流程执行脚本，或在同一目录直接运行官方 CLI：

```powershell
& 'C:\actual\dsh-runtime\node.exe' '.\node_modules\@playwright\mcp\cli.js' --extension --browser=chrome --port=8931 --host=127.0.0.1
```

## 3. 注册到 DSH：优先使用已有 MCP Manager

按当前 [DeepSeek 官方 MCP Manager 文档](https://github.com/deepseek-ai/deepseek-harness/blob/39163dd30f703a79079e2d2446545cff3c453738/packages/mcp/mcp-manager/README.md)，Web/Desktop profile 已包含 Manager；Settings 负责编辑 servers。目标机器的具体版本尚未提供，以本机实际界面及字段为准。

在 DSH Settings 找到已有的 **MCP Manager**（包名 `@deepseek-ai/dsh-mcp-manager`），在其 `servers` 表新增一个名为 `playwright` 的条目，只填以下字段，保留所有其他条目：

```json
{
  "transport": "streamable-http",
  "url": "http://127.0.0.1:8931/mcp",
  "enabled": true
}
```

等价配置结构是 `config.servers.playwright = 上述对象`，不是通用的 `mcpServers` JSON。保存后 Manager 会连接、初始化和枚举工具；若有 Probe，可先运行它检查工具发现，但 Probe 通过不代表浏览器已被接管。

不要直接用一个只含 playwright 的 `cordis.patch.yml` 覆盖现有配置：官方说明 patch 会替换完整 servers 表。通过 Settings 做局部新增最简单。

**只有本机没有 Manager，但已有 `@deepseek-ai/dsh-mcp-client` 时**，才把本包 `dsh-client.example.yml` 中的一行合入当前 profile composition。不要整文件覆盖；不要再装一个 Client，不要同时用两种注册方式重复注册 playwright。

如果本机两者都没有，或 Settings 没有这些字段，需要提供 DSH 版本并按对应版本的官方安装方式处理；本包不会修改或升级 Harness。

## 4. 最终验收：从自然语言开始

向 DSH 发送：

> 使用 Playwright 列出 Chrome 已打开的标签页，接管我选定的页面，读取页面快照，并告诉我页面标题和一个可交互控件。先不要点击、提交或修改业务数据。

应实际看到 DSH 调用 `mcp__playwright__browser_tabs` 和 `mcp__playwright__browser_snapshot` 并返回当前页面内容，而非口头描述。

随后在你允许的无副作用控件上验证点击，例如：

> 点击页面里只展开帮助说明的按钮，再读取快照，确认帮助内容出现。不要新增、删除、保存、提交或更改业务数据。

应看到 `mcp__playwright__browser_click` 的实际调用与点击后的快照。若页面没有此类控件，选你批准的等价只读操作。**工具被枚举、端口开放、点击执行成功，都不等于业务功能通过。**

最小权限做法：Server 在普通用户的 PowerShell 运行，只监听 `127.0.0.1`；DSH 通过已有 MCP 连接；浏览器权限通过官方扩展显式确认。不需要把整个 Harness 改成完全访问模式。

## 常见阻塞

| 现象 | 处理 |
|---|---|
| 找不到 Node | 指定现有 DSH Node 的完整路径；脚本要求 Windows x64 Node 24 |
| 8931 已占用 | 停止自己先前启动的服务；或 `-Port 8932` 并同步修改 DSH URL |
| DSH 没有 Playwright 工具 | 检查 Manager 连接状态、transport 和 `/mcp` URL；避免重复 serverName |
| 有工具但无法接管 | 确认扩展已启用，Chrome 已运行，并在扩展界面批准本次连接 |
| 沙箱无法访问 127.0.0.1 | 属于 Harness 网络权限阻塞；由其官方支持或 IT 配置允许的本地 MCP 通路，不切换 danger-full-access |
| 企业策略阻止扩展或脚本 | 请 IT 按公司流程批准，不绕过策略 |

## 构建与验证边界

官方来源：[Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)、[官方浏览器连接说明](https://github.com/microsoft/playwright.dev/blob/main/mcp/configuration/browser-extension.mdx)、[DeepSeek MCP Client](https://github.com/deepseek-ai/deepseek-harness/blob/39163dd30f703a79079e2d2446545cff3c453738/packages/mcp/mcp-client/README.md)。

GitHub Actions 使用 `windows-latest`、Node 24 x64、`npm ci --omit=dev --ignore-scripts`、`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`；依赖版本及 npm 官方下载 URL/完整性值均在 `package-lock.json` 锁定。微软包源码和许可证保留在 node_modules 中。

构建检查：实际在 Windows 解压后调用 `node .../cli.js --help`，启动 HTTP 服务，再做 MCP initialize / initialized / tools/list，确认 browser_snapshot、browser_click 等工具被发布。**不在 CI 连接用户 Chrome 或运行 Harness。**真实目标电脑的扩展批准、Harness 调用和登录页面操作，在用户实机完成前均为 **NOT TESTED**。

没有 GitHub Actions 时，在另一台有 npm 的 Windows x64 / Node 24 电脑上，取得仓库文件后运行 `offline-mcp\build.ps1`；ZIP 输出到 `dist`。目标电脑仍然不使用 npm。

在 GitHub 仓库的 **Actions → Build Windows offline MCP → Run workflow** 可重新构建。成功后在该次 Run 的 **Artifacts** 下载；也会在 **Releases** 中发布可直接下载的 ZIP 和 SHA256。Artifact 的外层 ZIP 里才是离线 ZIP，需再解压一次。

## ZIP 结构

```text
playwright-mcp-offline-win-x64/
  node_modules/                 # 官方包和全部生产依赖
    @playwright/mcp/
    playwright/
    playwright-core/
  package.json
  package-lock.json
  start-mcp.ps1
  dsh-client.example.yml
  README.md
```
