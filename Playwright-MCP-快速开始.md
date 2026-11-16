# Edge + DSH：后台启动与 Token 自动连接

本次更新保留已跑通的 Microsoft Playwright MCP 0.0.85 和 Extension 0.5.0，不换浏览器，不走 CDP。统一包中同时有 extension 和 server。

## 一次性设置（在 Windows 用户会话中完成）

1. Edge 打开 `edge://extensions/`，保持 Playwright Extension 启用，用户自行登录目标网站。不要指定新的 user-data-dir。
2. 点击 **Edge 的 Playwright 扩展图标**，在其状态/客户端页面复制 **PLAYWRIGHT_MCP_EXTENSION_TOKEN**。这是这个 Edge 用户资料自己的扩展 Token，不是模型 API Key、Cookie 或 HTTP Bearer Token。
3. 在统一包根目录打开普通 CMD（文件夹地址栏输入 `cmd`），执行：

```bat
server\mcp.cmd token-file
```

记事本会打开 `%LOCALAPPDATA%\PlaywrightMCP\extension-token.txt`。只粘贴 Token 的值，一行，不加引号，不加变量名，保存关闭。这个文件不在离线包、OneDrive 工作目录或 Git 仓库中，不发到聊天和 GitHub。也支持从环境变量 PLAYWRIGHT_MCP_EXTENSION_TOKEN 读取；环境变量优先。

4. 如果旧前台 MCP 还在运行，先在原 PowerShell 窗口 Ctrl+C 停掉它，再运行：

```bat
server\mcp.cmd start
```

显示 `Background MCP ready` 后可以关掉终端窗口。Server 已脱离启动终端，继续在后台运行。Node 使用 DSH 已有的 dsh-primary-runtime 路径，不要求 PATH、npm、独立 Node 或 PowerShell 脚本权限。若 DSH 运行时在其他位置，先 `set "DSH_NODE_EXE=C:\实际路径\node.exe"`。

## 后续完全省去手动启动（可选）

确认后台已正常运行后，在同一个沙箱外 CMD 执行一次：

```bat
server\mcp.cmd enable-autostart
```

它只在**当前用户的 Startup 文件夹**写一个本包的启动项，不创建管理员服务，不修改执行策略。以后 Windows 用户登录时自动拉起后台 Server；启动项的 CMD 可能短暂闪过，但不保留终端窗口。请勿移动或删除离线包目录。公司若禁止用户启动项，不绕过，由 IT 提供批准的启动方式。

取消本包的登录自启动：

```bat
server\mcp.cmd disable-autostart
```

自启动在用户登录后发生，不能代替公司 SSO 登录，也不是开机前的 Windows 系统服务。Token 不能把沙箱内进程变成沙箱外进程。首次启动/自启动设置必须在普通用户宿主环境完成；以后 Harness 通过已注册的 loopback HTTP 使用后台服务。不要再从沙箱内 spawn Edge，也不要升级 danger-full-access。

## 状态与停止

```bat
server\mcp.cmd status
server\mcp.cmd stop
```

status 会实际执行 MCP 初始化和工具发现，不能用 TCP 或浏览器打开 /mcp 代替。stop 通过本包自己的本地控制通路只停止自己持有的 Server 子进程，不按旧 PID 盲杀进程，不结束 DSH 或 Edge。停止后再次 start 会重新读取 Token。新启动遇到 8931 被占用会报错，不顶掉未知服务。

运行日志与管理状态在 `%LOCALAPPDATA%\PlaywrightMCP\`。Token 不会由启动器打印到终端或写进命令行。日志可能包含本机运行错误，不要整目录上传。

## DSH 注册仍只做一次

服务名 `playwright`；transport `streamable-http`；URL `http://127.0.0.1:8931/mcp`；enabled `true`。**扩展 Token 注入的是 Server 环境，DSH 的 HTTP headers 不需要填写这个 Token。**

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


## 已注册后，直接把这段给模型

```text
Playwright MCP 在沙箱外的普通用户环境后台运行，URL 为 http://127.0.0.1:8931/mcp。
Edge 扩展 Token 已在本机配置，别读取、回显、上传 Token，也不要从沙箱内重新启动 Server 或 Edge。
请实际调用 mcp__playwright__browser_tabs，核对标签页标题与 URL，再选择我指定的业务页面并调用 browser_snapshot。不要把空白页、扩展连接页或其他业务站点当成目标页面。
如果只看到新空白标签页，不要宣称已控制全部原有标签页。Token 只解决连接认证，标签页范围仍按扩展实际授权和版本处理；先报告可控制范围，再决定是否在受控标签页打开用户指定页面。登录状态是否可复用，以真实快照为准。
页面有 iframe 时继续读取其可访问性内容，再开始只读功能测试。不要先写 Python/CDP 兜底客户端。
没有真实 MCP 工具就报告配置/权限阻塞，不要只写计划或假装调用成功。新增、删除、上传、提交、模型试跑等生产写操作仍需我明确批准，Token 不是业务操作的概括授权。
```

## 能保证什么

- 后台 Server：无需一直留着 PowerShell/CMD 窗口。
- 官方扩展 Token：按官方机制避免每次点击连接批准；Token 必须属于安装扩展的同一个 Edge 用户资料。Token 失效/轮换后更新本地文件并 stop/start。
- `--background`：减少扩展唤起标签页、窗口抢焦点；具体浏览器版本和窗口状态可能仍影响可见行为，不能保证所有 Edge 版本全程无 UI。
- 不自动登录企业系统，不改策略，不绕过沙箱，不在公开包内保存任何企业地址或数据。

用户已报告旧前台方案在目标电脑能列标签页和读快照；本次新后台/Token 方式在目标电脑上尚未实测。CI 用非真实占位 Token 检查后台启动、重复启动、MCP 工具发现和停止，不把它冒充真实 Edge 授权成功。

官方依据：[Microsoft Extension Token 和 background 说明](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md)，[DSH MCP Manager](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-manager)。
