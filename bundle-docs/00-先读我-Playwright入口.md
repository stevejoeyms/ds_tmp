# Playwright 在这里：给用户和 Harness 的入口

本版已在启动器局部固化DSH心跳兼容设置，无须手动设置环境变量。升级先退出DSH并在旧包停止MCP，再启动新版，详见一键启动说明。

日常用户入口：双击本包 **启动Harness.cmd**，先就绪后台MCP，再打开相邻 `DeepSeek Harness New\DeepSeek Harness.exe`。不装登录自启动。首次说明见 [一键启动说明.md](一键启动说明.md)。初始化会把本机Python/Playwright路径提示合并到DSH home的AGENTS.md；是否已加载仍需真实会话验证。离线Python使用 `tools.cmd python`，不要猜系统PATH里的python。

## 这是什么

这是 **Microsoft Playwright MCP 的 Edge 离线运行包**。它让 Harness 通过原生工具读取网页可访问性快照、点击控件、填写输入、切换标签页和验证页面结果，复用用户已登录的 Edge 会话。

运行结构：**Harness 原生 MCP Client → 本机后台 Server → Edge Playwright Extension → 网页**。目标电脑无需 npm/npx 或独立 Node；Server 使用 DSH 自带 Node。登录由用户完成；生产写入、上传、导出等操作按明确授权执行。

适用基线：MCP 0.0.85 / Extension 0.5.0 / DSH 0.2.2-rc.1。实际工具列表与参数定义优先于本文和模型训练记忆。

## 给模型的发现顺序

1. 用户要求“操作网页、Edge、浏览器、UI功能测试、Playwright”时，先查当前原生工具列表中的 `mcp__playwright__*`。
2. 先读 [best-practices/MODEL-INSTRUCTIONS.md](best-practices/MODEL-INSTRUCTIONS.md)，再用 `mcp__playwright__browser_tabs`、`mcp__playwright__browser_snapshot` 核实真实页面。工具已可用时不要重新安装、重复注册或重启Server。
3. 不会填参数时读 [工具配方](best-practices/TOOL-RECIPES.md)；遇到错误读 [排错表](best-practices/PITFALLS.md)。本版点击/输入用 `target`，不是旧示例的 `ref`。
4. 原生工具不存在时，才读 [Harness配置说明.md](Harness配置说明.md)。rc.1 使用官方 Client `insert`，不找不存在的 Manager，也不编造 `mcpServers.json`。
5. 不另写一次性 Python/CDP 客户端。连接持续复用，先选已有目标tab；Token与后台模式不能替代会话管理。

`http://127.0.0.1:8931/mcp` 是 MCP 协议端点，不是业务网页，也不是在地址栏打开就能操作的界面。

## 最简单的交给模型方式

把本文件或整个解压目录作为附件/上下文提供给 Harness，然后发送：

```text
这是已经准备好的 Playwright Edge MCP 离线包。
请先读本包的 00-先读我-Playwright入口.md，再读 best-practices/MODEL-INSTRUCTIONS.md。
先检查当前是否已有 mcp__playwright__ 原生工具；已有就直接复用，不安装、不重新注册、不另起Server或Python客户端。
我的目标页面、测试环境、允许操作和预期结果是：〔由我填写〕。
先列出受控标签页并核对目标，读取快照；只报告真实工具结果，未经批准不操作业务写入。
```

模型不知道包的路径时，请提供解压目录的完整路径，或附上本文件。需要自行查找时，只在用户指定目录/当前工作区内有限查找此入口，不扫描全盘、浏览器用户资料或凭据目录。

## 文件地图

| 要做什么 | 读哪个文件 |
|---|---|
| 模型开始操作 | [短指令](best-practices/MODEL-INSTRUCTIONS.md) |
| 参数、iframe、表单、等待 | [工具配方](best-practices/TOOL-RECIPES.md) |
| 输入生效与业务判定 | [通用规则](best-practices/STATE-AND-ASSERTIONS.md) |
| 标签页增长、工具报错等 | [排错表](best-practices/PITFALLS.md) |
| 首次接入、后台/Token | [Harness配置说明](Harness配置说明.md) |
| 参数精确查阅 | [真实25工具schema](best-practices/tool-catalog-0.0.85.json)，按需读，不整份塞进对话 |

根目录还提供 `AGENTS.md` 作为发现提示。**它不是插件安装器，不保证 DSH 自动读取：是否自动加载取决于当前工作区和该版本指令文件机制。** 不要覆盖其他项目已有的AGENTS.md；需要长期提示时，只将相关几行合并到你已有的工作区说明中。
