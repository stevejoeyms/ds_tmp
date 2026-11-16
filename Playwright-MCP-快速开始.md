> 最佳实践入口：统一包根目录 best-practices/README.md。首次任务让模型先读 best-practices/MODEL-INSTRUCTIONS.md。

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

## 日常启动：一个脚本先MCP后Harness

在统一包根目录双击 **启动Harness.cmd**。脚本先探测/复用MCP；未运行时后台启动，协议初始化与工具发现成功后，打开相邻的 `DeepSeek Harness New\DeepSeek Harness.exe`。不设置登录自启动，不强关已有Harness；已运行的旧进程若未加载新配置，应正常完全退出后再运行脚本。

首次缺Token时引导用本机记事本填写；后续无需重复粘贴。修复Token用 `重新配置Token.cmd`。统一入口优先使用本地Token文件，避免旧环境值覆盖；直接调用旧 `server\mcp.cmd` 时仍为环境变量优先。协议就绪只能确认Server，无法证明扩展Token有效或已完成SSO。

完整目录摆放、Python和DSH说明见根目录 **一键启动说明.md**。Server必须由用户在沙箱外启动，Token不会改变权限边界，不修改策略。

## 状态与停止

```bat
server\mcp.cmd status
server\mcp.cmd stop
```

status 会实际执行 MCP 初始化和工具发现，不能用 TCP 或浏览器打开 /mcp 代替。stop 通过本包自己的本地控制通路只停止自己持有的 Server 子进程，不按旧 PID 盲杀进程，不结束 DSH 或 Edge。停止后再次 start 会重新读取 Token。新启动遇到 8931 被占用会报错，不顶掉未知服务。

运行日志与管理状态在 `%LOCALAPPDATA%\PlaywrightMCP\`。Token 不会由启动器打印到终端或写进命令行。日志可能包含本机运行错误，不要整目录上传。

## DSH 0.2.2-rc.1 原生注册（已注册成功就跳过）

此版本没有 MCP Manager，已有官方 dsh-mcp-client。不要找 Manager 设置页，不要写 config.servers，也不要把 ACP 的 type:http 写进 Cordis。

用户现场已确认 Desktop 活动 profile 由 DSH_PROFILE_DIR 指向 `%USERPROFILE%\.dsh\profiles\desktop`。其他部署先核实该环境变量，不猜路径。备份实际 cordis.patch.yml，保留原条目，合入本包 dsh-client.example.yml：

```yaml
- insert:
    - id: mcp-playwright
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: playwright
        transport: streamable-http
        url: http://127.0.0.1:8931/mcp
```

不要重复追加同一条目。默认未设置 failOnStartupError，不声称它已经开启。Token 在 Server 环境中注入，不填 DSH HTTP headers。Server 继续运行，重启 DSH 并新建会话；先核实原生 mcp__playwright__browser_tabs / browser_snapshot 真正出现，再连续读取同一tab验证复用。

ACP 的 mcpServers 是 session/new/resume 的请求参数，不需要寻找一个假想的 mcpServers 配置文件。原生工具不可用时看实际加载错误，不回到每命令新建Python客户端。

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

官方依据：[Microsoft Extension Token 和 background 说明](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md)，[DSH rc.1 MCP Client](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/mcp/mcp-client/README.md)。
