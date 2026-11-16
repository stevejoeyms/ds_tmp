# 调研依据与实际验证

## 证据优先级

现场工具定义 > 本包真实tools/list导出与锁定源码 > 对应发布版官方文档 > 当前官方通用指南 > 模型训练记忆。版本升级后重新核验，不能只改文档里的版本号。

本次综合了浏览器自动化、Windows部署、MCP协议、功能测试判定及模型上下文使用五个视角；这不是多模型投票，也没有实际验证企业业务页面。

## 固定版本

| 组件 | 本包依据 |
|---|---|
| @playwright/mcp | 0.0.85；官方tag v0.0.85指向4e0794dd0a0176519830a5ed27b491137cf9338f |
| playwright / playwright-core | package-lock精确锁定1.66.0-alpha-2026-11-09，来自registry.npmjs.org；这是alpha依赖，本文不自动升级 |
| Extension | 导出的0.5.0；生命周期另外直接核对其background.mjs（关闭连接移除集合、释放/取消分组不自动关闭页面） |
| DSH | 官方tag dsh-v0.2.2-rc.1，commit 66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db；不能套master的Manager说明 |

## 官方参考（均于2026-11-16核对）

1. [MCP0.0.85发布文档](https://github.com/microsoft/playwright-mcp/blob/v0.0.85/README.md)：target、find、unsafe工具、可选testing、shared context。
2. [MCP0.0.85 package.json](https://github.com/microsoft/playwright-mcp/blob/v0.0.85/package.json)：依赖版本。
3. [Playwright最佳实践](https://playwright.dev/docs/best-practices)：用户可见行为、可靠定位、隔离的通用原则；登录资料复用是本部署明确的限制，不机械新建context。
4. [Locators](https://playwright.dev/docs/locators)：语义定位、歧义与严格匹配。本文主线仍用现场快照target。
5. [Auto-waiting](https://playwright.dev/docs/actionability)：可操作性检查不等于业务条件完成。
6. [Assertions](https://playwright.dev/docs/test-assertions)：真实重试断言与动作的区别；本包没有自动注入Playwright Test的expect。
7. [Frames](https://playwright.dev/docs/frames)：页面主frame与iframe定位边界。
8. [Evaluating JavaScript](https://playwright.dev/docs/evaluating)：页面环境与Playwright进程环境的区别。
9. [Dialogs](https://playwright.dev/docs/dialogs)：原生对话框与页面DOM弹窗。
10. [Downloads](https://playwright.dev/docs/downloads)：下载事件、路径和文件处理；本文没有企业导出实测。
11. [官方Extension说明](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md)：Token/profile、tab归属和background；此文档可能领先0.5.0，因此不把所有最新行为当作当前包保证。
12. [MCP HTTP会话规范](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#session-management)：Mcp-Session-Id、DELETE和逻辑会话。
13. [DSH rc.1 Client](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/mcp/mcp-client/README.md)：transport、工具命名、连接生命周期。
14. [DSH rc.1 insert patch指南](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/docs/user/guide/mcp-memory.md)：挂载Client和profile覆盖层。
15. [DSH rc.1 ACP入口](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/acp/acp/src/index.ts#L199)：mcpServers来自session/new/resume参数，不是推测出来的配置文件。
16. [DSH rc.1 Client连接源码](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/mcp/mcp-client/src/connection.ts)：capabilities:{}，不要假设向MCP提供workspace roots。

## 直接核验的包内实现

在 node_modules/playwright-core/lib/coreBundle.js 按原始模块名定位：
- tools/utils/mcp/server.ts：tools/list只取schema；首次tools/call才创建backend；连接close处dispose。
- tools/backend/find.ts：实际获取AI快照后查找；text/regex二选一、maxResults正整数。
- tools/backend/form.ts：textbox.fill、checkbox/radio.setChecked、combobox.selectOption，故自绘combobox不能照抄。
- tools/backend/wait.ts：Promise.race；当前page.getByText(...).first；秒数最多30，不是iframe等待。
- tools/backend/runCode.ts：真实名字browser_run_code_unsafe；不提供expect/require/process等测试全局。VM不是安全承诺。
- tools/mcp/browserFactory.ts与program.ts：Extension attached路径、可选共享浏览器状态。
- tab目标解析：e12/f1e9形式引用与selector/locator是不同路径；[ref=e12]须只取e12。

## 验证范围

- 已真实启动锁定MCP、initialize / initialized / tools/list，导出默认25个工具及JSON Schema，最后DELETE并停止临时服务；没有执行任何tools/call。
- examples.json已按真实导出的schema校验：18个正例通过，7个负例被拒绝（旧ref、缺必填字段、错误action、checkbox布尔值等）。使用现有官方依赖捆绑的Zod JSON Schema转换；校验前去除default注解，避免转换器自动填值掩盖JSON Schema required约束。无新增目标机依赖。
- 3个Node/页面函数片段另做JavaScript语法检查并通过；带占位URL/target的例子不是可直接执行的企业测试。
- 上一版Windows后台运行的start、重复start、协议status、stop已在[此CI](https://github.com/stevejoeyms/ds_tmp/actions/runs/43816021632)通过；本次只更新手册和静态样例，不修改运行代码、扩展或依赖。
- 未实测：本文控件配方在目标企业站点的适配、真实iframe跨源场景、企业导出/写操作、弱模型遵循率。不能把文档正确或参数合法说成业务测试PASS。

## 独立只读审阅

新增手册与范例经过独立只读审阅，复核了18个范例、固定版本源码和DSH rc.1接入方式，未发现新的P1/P2问题。审阅不等于目标企业页面或弱模型遵循率已验证。统一包采用 scripts/bundle-best-practices.py 另行组装，不声称原server-only Actions产物自动包含根目录手册。
