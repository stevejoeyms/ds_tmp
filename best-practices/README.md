# Playwright MCP 最佳实践：当前内网部署 MVP

适用基线：MCP **0.0.85**，其锁定 Playwright/Core **1.66.0-alpha-2026-11-09**（注意依赖本身是 alpha），Extension **0.5.0**，Windows x64 / DSH **0.2.2-rc.1** / Edge。调研日期 2026-11-16。不升级运行依赖，不改已跑通的启动方式。

**已经接通的电脑只需取本目录手册，不必替换运行文件、重启Server、重新注册Client或重复配置Token。**

## 只做四件事

| 边界 | 最小正确做法 | 防止的误判 |
|---|---|---|
| 连接 | 沙箱外后台 Server + DSH 原生 HTTP Client 持续复用 | 反复 Python initialize/call 导致新客户端、新页 |
| 页面 | 每次任务先 tabs list/select，核对 URL、标题和环境 | 在空白页、扩展页、另一个站点上测试 |
| 动作 | 最新快照/查找给出目标 → 一次动作 → 查看结果 | 旧 ref、错误参数、猜选择器、连续盲点 |
| 判定 | 执行前明确预期，执行后用可见结果比较 | 点击成功/HTTP 200/端口开放被写成业务 PASS |

## 怎么使用这些文件

1. 让 Harness **先读 MODEL-INSTRUCTIONS.md**。这是一页左右的主规则；无需每轮重塞整套文档。
2. 不会填写工具参数时，只查 TOOL-RECIPES.md 的对应条目；机器可读例子在 examples.json。
3. 出错查 PITFALLS.md；出现版本差异以当前会话真实工具 schema 为准，静态手册不能覆盖运行时能力。
4. tool-catalog-0.0.85.json 是从真实 MCP tools/list 导出的 **25 个默认工具**，含完整参数 schema，供定点查阅，不要一次整份塞给较弱模型。
5. SOURCES.md 记录固定版本、官方依据及验证边界。范例参数校验通过不等于目标页面动作已经验证。

只需向 Harness 发：

> 先读取本包 best-practices/MODEL-INSTRUCTIONS.md，按当前原生 Playwright 工具执行。遇到参数问题查 TOOL-RECIPES.md，不要凭旧训练数据猜接口。我的目标 URL、测试环境、允许操作和预期是：……

**这些 Markdown 不会自动变成 DSH 系统指令或权限规则。** 需要模型实际能读文件或把短规则复制到对话/已有指令中；这里只交付手册，不自动改 DSH preset、全局 AGENTS 或权限。

## 推荐优先级

- 高频主线：browser_tabs、browser_snapshot、browser_find、browser_type、browser_click、browser_wait_for。
- 按需：browser_fill_form、browser_select_option（原生 select）、browser_take_screenshot、browser_console_messages、browser_network_requests。
- 单独审阅后使用：browser_evaluate、browser_run_code_unsafe、上传、拖拽、确认对话框、关闭标签页。工具的 readOnlyHint 不是业务授权。

**无需新建常驻 Python 驱动、测试框架、代理服务或报告系统。** DSH 已提供 MCP Client。不要为减少客户端数就默认启用 shared-browser-context；它让多个客户端共享页面状态，带来相互切页、输入覆盖的风险。

## 开始任务前只问这些

目标 URL/环境、允许做什么、哪些动作禁止、怎样算通过。未知业务规则时先做探索并记为未判定，不自行编造结果数量、字段规则或成功文案。

不要把官方自动化测试“每条用例新建隔离 context”的通用建议直接套到本部署：这里的契约是复用用户登录资料。用单会话、串行执行、记录筛选状态保证可解释性；不要清 Cookie、重置 Profile 或新建 isolatedContext 来强行隔离。

## 最小只读功能测试

| 用例 | 动作前先确定 | 执行后核对 |
|---|---|---|
| 页面就绪 | 目标 URL、页面标题、关键筛选区域 | 正确环境、表格/筛选控件实际可见；iframe 不是空壳 |
| 查询一个已知条件 | 授权的查询值、该条件应满足的业务规则 | 输入值、查询完成、结果行满足条件；仅看到表格不够 |
| 无结果 | 有依据的无结果条件 | 加载结束后明确空状态；空快照/请求失败不能当无结果 |
| 重置 | 操作前可见筛选值、预期默认值 | 字段恢复到约定值；是否自动查询按实际产品契约判断 |
| 分页 | 总数、当前页、页大小及排序条件 | 页码改变；有数据时首行/记录集合相应变化，不只按钮高亮 |
| 详情 | 明确允许只读打开；记录主键 | 详情对应同一记录，不保存、不触发审核/试跑 |

有并发业务数据变化时，总数或行顺序可能变化，记录时间与前提；不要依赖历史快照里的固定总数。导出/下载可能包含敏感数据或异步任务，先获准再做，不列为默认 smoke。

## 结果记录只用一张小表

`用例 | 预期 | 实际可见结果 | 证据路径/摘录 | PASS/FAIL/BLOCKED/NOT_TESTED/INCONCLUSIVE`

PASS=已执行且观测满足预期；FAIL=环境和前提满足但观测违背预期；BLOCKED=工具/权限/登录阻塞；NOT_TESTED=没执行；INCONCLUSIVE=执行了但缺少可判定依据。工具返回 isError、超时、点击完成都不是业务 PASS。

证据默认保留在目标电脑获准的本地工作区；截图、快照、网络内容可能包含企业数据，不进本公开仓库。文件名不包含客户姓名、账号或 Token。
