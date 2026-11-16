# Edge + DeepSeek Harness 使用说明

更新：2026-11-16。目标是控制 **Edge 中已经登录的页面**。无需 npm、npx、Python 或独立 Node；只用官方 Extension 和 Server。

## 第一步：确认扩展装在 Edge

在 Edge 打开 `edge://extensions/`，确认 **Playwright Extension** 已启用。原来的扩展 ZIP 可以继续使用，无需重打包。如果尚未安装，下载 [扩展 ZIP](https://raw.githubusercontent.com/stevejoeyms/ds_tmp/main/playwright-extension-0.5.0.zip)，解压后在该页面开启开发者模式，选择「加载解压缩的扩展」并选中含 `manifest.json` 的文件夹。

在装扩展的同一个 Edge 用户资料中打开目标网站，自行登录，保持窗口打开。官方商店来源：[Microsoft Playwright Extension](https://chromewebstore.google.com/detail/mmlmfjhmonkocbjadbfplnigmagldckm)；企业策略禁止安装时交给 IT，不绕过。

## 第二步：启动 Edge 版 Server

从 [本仓库 Releases](https://github.com/stevejoeyms/ds_tmp/releases) 下载最新 **Playwright MCP Windows x64 offline** 发布中的 `playwright-mcp-offline-win-x64.zip`，不要选 Source code。

旧版 ZIP 的脚本固定 Chrome。请换本次 Edge 版；扩展及 npm 依赖版本不变。

解压后，在文件资源管理器进入含 `start-mcp.ps1` 的文件夹，地址栏输入 `powershell` 并回车。在打开的**普通 PowerShell** 中运行：

```powershell
.\start-mcp.ps1 -Browser msedge
```

脚本自动查找 DSH 自带 Node 24 x64。看见 `Listening on http://127.0.0.1:8931` 后，保持窗口打开。要停止时在此窗口按 Ctrl+C。

如果脚本执行被策略拦截，不改 ExecutionPolicy。让 Harness 找出原有 DSH `node.exe` 的准确路径，然后由你在普通 PowerShell 执行以下官方命令（替换 node 路径）：

```powershell
& 'C:\实际路径\node.exe' '.\node_modules\@playwright\mcp\cli.js' --extension --browser=msedge --port=8931 --host=127.0.0.1
```

**关键是 `--extension --browser=msedge`。** 不用 Chrome，不下载 Chromium，不启动隔离浏览器。HTTP 地址不能在浏览器打开来证明连接成功，需 DSH 完成 MCP 握手与工具发现。

## 第三步：把这段完整发给 Harness，只配置一次

```text
我要通过 Microsoft Playwright MCP 控制现有 Edge 登录会话。
Server 已由我在沙箱外启动，地址 http://127.0.0.1:8931/mcp，模式 --extension --browser=msedge。

请先做配置和工具发现，不要开始操作业务页面：
1. 核实当前 DSH 版本和实际活动 profile，读取其已有配置，找出 @deepseek-ai/dsh-mcp-manager 的实际条目 ID。官方 Web/Desktop 默认 ID 是 mcp-manager，不要照抄示例的 mcp，也不要假设存在通用 mcpServers.json。
2. 已有 Manager 时，保留已有服务器，在 config.servers 中合并 playwright 条目：transport=streamable-http，url=http://127.0.0.1:8931/mcp，enabled=true。优先使用本机确实存在的设置接口；没有 MCP 表单就处理实际 profile 的 cordis.patch.yml。
3. 修改前备份，只改必要字段，不覆盖完整配置。没有 Manager 但已有官方 dsh-mcp-client 时，按官方 insert patch 接入；不要 npm/npx 安装，不要重复注册同名服务。
4. 如果 workspace-write 禁止写活动配置，不扩大权限，也不要反复重试。只输出我应修改的准确文件路径、必要片段和手动步骤。
5. 配置生效后核实真实工具列表里有 mcp__playwright__browser_tabs、mcp__playwright__browser_snapshot、mcp__playwright__browser_click。仅端口可连不算完成。需要重启 DSH 或新建会话时明确告诉我。
6. 若工具不可见，报告实际连接错误与缺失环节；不要假装已注册，不要改用 requests、Python 抓取或在沙箱中启动 Chromium。
```

**手动填写时只需这四项：**

| 字段 | 值 |
|---|---|
| 服务名 / servers 的键 | `playwright` |
| 传输 | `streamable-http` |
| URL | `http://127.0.0.1:8931/mcp` |
| 启用 | `true` |

Header、Token、command、args 在本次 HTTP 注册中不填。不同 DSH 版本的界面可能不同；别为了找菜单而新装 Client。

若必须手动编辑：下面是**当前官方默认 Manager ID** 的 patch 结构，需合入实际活动 profile；如果 ID 不同，改成查到的值。如果已有其他 servers，必须保留原有全部条目。不要把这段覆盖整个文件。

```yaml
- id: mcp-manager
  config:
    servers:
      playwright:
        transport: streamable-http
        url: http://127.0.0.1:8931/mcp
        enabled: true
```

CLI profile 的 patch 通常在 `$DSH_HOME/profiles/<name>/cordis.patch.yml`；Desktop 可使用应用自有 profile 目录，以本机实际值为准。配置重载后仍没工具，就正常重启 DSH 并新建会话；Server 窗口继续保持打开。

## 第四步：让 Harness 真正接管 Edge

把下面这段发给 Harness：

> 请实际调用 mcp__playwright__browser_tabs 列出 Edge 标签页，等我确认目标标签页。然后选择该标签页，调用 mcp__playwright__browser_snapshot，告诉我页面标题和一个可点击控件。先不要点击或提交，不要新增、删除、保存任何业务数据。不要只写计划，需给出真实工具调用结果。

首次浏览器工具调用可能打开 Playwright 连接确认页。在 **Edge** 中按界面批准连接/选择允许控制的标签页。扩展已启用并不代表本次连接已批准。批准后若第一次调用超时，让 Harness 再试一次。

能返回你当前登录页面的标题和控件后，再发自然语言任务，例如：

> 在刚才的页面打开帮助说明，读取说明内容后告诉我。只操作这个只读帮助控件，不更改业务数据。

看到真实 `browser_click` 和随后快照，才确认模型确实能控制页面。

## 卡住时只看这一表

| 现象 | 下一步 |
|---|---|
| 参数 Browser 不存在 | 你还在运行旧脚本，下载 Edge 版；或用上面的官方 CLI 命令 |
| 报 Chrome 扩展不存在 / 打开 Chrome | 启动参数仍是 chrome，Ctrl+C 停旧服务后用 msedge 重启 |
| 8931 已占用 | 不要再开第二个 Server；先确认旧服务是否 Chrome，再在其原窗口 Ctrl+C 停止 |
| 有 Server，Harness 没 Playwright 工具 | 注册尚未生效，核对活动 profile、Manager ID、HTTP URL 和日志 |
| 有工具但 Extension not connected / 超时 | 看 Edge 连接确认页、扩展启用状态，以及扩展所在用户资料 |
| 报 Extension not found in 某个 Profile | 扩展装在另一个 Edge 用户资料；在已装扩展的资料中打开目标页面，按官方 --profile-dir-name 选择必要的资料 |
| 无法访问 127.0.0.1 或无法写配置 | 属于权限边界，手动注册或交 IT 按批准方式处理，不切换 danger-full-access |

日常使用只需：**Edge 登录 → 启动 Server → 打开 DSH 发任务**。注册只做一次；新连接仍可能需要扩展确认。

当前实际验证范围：GitHub Windows 构建会检查解压后 CLI、Extension 模式 HTTP 启动及 MCP 工具发现；你的目标电脑上的 DSH / Edge 授权和页面操作尚未实测，不能提前判定成功。

## 官方依据

- [微软浏览器连接与 Extension](https://github.com/microsoft/playwright.dev/blob/main/mcp/configuration/browser-extension.mdx)
- [DSH MCP Manager](https://github.com/deepseek-ai/deepseek-harness/blob/39163dd30f703a79079e2d2446545cff3c453738/packages/mcp/mcp-manager/README.zh.md)
- [官方默认 Manager ID](https://github.com/deepseek-ai/deepseek-harness/blob/39163dd30f703a79079e2d2446545cff3c453738/packages/bundle/web-app/cordis.patch.yml#L153)
- [DSH 官方 MCP patch 与 profile 路径示例](https://github.com/deepseek-ai/deepseek-harness/blob/39163dd30f703a79079e2d2446545cff3c453738/docs/user/guide/mcp-memory.zh.md)
