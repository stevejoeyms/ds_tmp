# Verification

代码版本：97af6e6b7f388568f148cdcc6712ca89a665f0c2。验证日期2026-11-16。仅文档、验证记录及规格归档在该版本后变更，最终ZIP SOURCE.json登记最终组包commit。

| AC | 位置/命令 | 环境与结果 |
|---|---|---|
| AC-01 | bootstrap/setup.test.mjs；bootstrap/windows-check.ps1 | Node原生21/21通过；Windows真实Python3.12 UTF8、中文/空格/&路径、caller cwd、参数及退出码7传递通过 |
| AC-02 | setup-core.mjs/clientPatch、commitFiles | 官方空[]首次patch、自定义BOM/CRLF/注释/无关!!js原字节保留；幂等、防重、冲突、动态composition/alias拒绝、失败回滚与并发保护通过 |
| AC-03 | locateDsh、buildInstructions、environmentMarkdown | 官方manifest标准Desktop确认；自定义bundle拒绝；本机索引不含Token；真实DSH上下文加载NOT TESTED |
| AC-04 | probeMcp、initialize | Windows真实后台MCP启动/initialize/list/DELETE及复用通过；不调用browser；目标机真实Token/原生Client调用NOT TESTED |
| AC-05 | main/launch；Windows无害模拟EXE | 就绪前不打开，就绪后实际执行EXE、传入一致home通过；无登录自启动；真实DSH程序NOT TESTED |
| AC-06 | tokenState/mcpCommand/token | Token仅本机文件/进程环境，文件优先、不回显；协议不伪装认证；真实交互Notepad/Edge认证NOT TESTED |

实际命令：node --test bootstrap/setup.test.mjs（本机临时回环需沙箱外运行）；Windows workflow执行offline-mcp/build.ps1，内含同21项测试及bootstrap/windows-check.ps1，随后ZIP解压后cli.js --help与独立MCP协议检查。
最终Windows成功日志：https://github.com/stevejoeyms/ds_tmp/actions/runs/43836585830 （2026-11-16 09:05–09:06 UTC）；前一轮b567c8b也通过，但后续修复以此轮为准。

独立只读审查：review_offline_package 发现5项，均修复：启动home/profile不一致；仅凭cordis注释确认profile；继承层重复Client；官方空flow patch拒绝；动态composition alias漏检。审查者在97af6e6独立复跑21/21通过，修复后无剩余阻断。范围明确不实现任意Cordis/!!js解释器；非标准或改过应用bundle转人工。

组包实跑：python3 scripts/bundle-best-practices.py <已校验background基础ZIP> <临时输出> --source-commit 97af6e6...，241个文件、219个既有文件字节不变，ZIP CRC/全部SHA256清单通过；额外检查入口齐全、CMD CRLF、无登录自启快捷方式、无.local/ENVIRONMENT/备份/Token文件、无企业域名或账号。最终文档加入后将使用最终commit重组包并重复相同断言。

G1/G2 PASS仅指Windows CI；G3真实DSH、G4真实Edge、G5业务测试均NOT TESTED。发行说明与包内PORTABLE-VALIDATION.md明确此边界。Python仅以Runner Python执行集成检查，用户已有47库需实机按需import；模型加载AGENTS须新会话实测。
