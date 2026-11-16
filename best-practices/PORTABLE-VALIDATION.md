# 便携启动版实际验证范围

版本基线：官方MCP0.0.85、Extension0.5.0；DSH配置针对0.2.2-rc.1标准Desktop；使用用户已有Node24和Python3.12 x64，不随包分发Python/Harness。

[Windows最终构建](https://github.com/stevejoeyms/ds_tmp/actions/runs/43836585830)，代码97af6e6：21/21定向测试通过。Windows真实执行了官方空patch首次初始化、自定义YAML字节备份、重复初始化幂等、中文/空格/特殊字符路径、Python参数/工作目录/UTF8/退出码、后台MCP真实协议就绪与复用、就绪前不打开程序/就绪后启动模拟Harness、传入一致DSH home、doctor与停止自有子进程。没有调用浏览器工具，没有安装登录自启动。

Windows使用Runner已安装Python3.12及临时profile、无害模拟Harness程序；没有使用用户的完整47库嵌入Python，也没有假装模拟程序等于真实DSH。目标机仍按一键启动说明做最终验收。

| 验收 | 结果 | 实际边界 |
|---|---|---|
| G1 离线依赖/CLI | PASS（Windows CI） | ZIP解压后用Node执行cli.js --help，无目标npm依赖 |
| G2 HTTP Server | PASS（Windows CI） | 实际后台启动与MCP initialize/tools/list/DELETE |
| G3 DSH原生工具 | NOT TESTED（本交付验证） | 初始化器/配置fixture已测，真实DSH加载及工具调用需目标机验证 |
| G4 Edge现有会话 | NOT TESTED | 需要本机扩展、真实Token和用户授权 |
| G5 企业页面功能 | NOT TESTED | 本轮不访问业务系统、不把工具发现当业务PASS |

Token可用形态与浏览器认证是两件事；启动器不宣称能从tools/list识别Token过期。包内最佳实践包含持久Client/标签复用规则，禁止每步新建一次性MCP浏览器客户端。

模型发现验证：初始化写入DSH home的AGENTS标记块后，正常退出旧Harness，再用启动脚本打开。新会话要求模型说出实际Python入口、执行一次真实Python命令，再用原生browser_tabs/browser_snapshot连续读同一页面并确认页面数没有无意增长。配置写入/端口通/程序启动请求均不等于这项验收通过。

## 心跳兼容修复（2026-11-16）

用户提供的目标机实测：保留background，仅将MCP子进程环境 `PLAYWRIGHT_MCP_PING_TIMEOUT_MS=0` 后，原生连接在20秒、65秒仍有效，并完成公开页面搜索。此为用户现场报告，本发布者未独立接入目标机复测；不扩展为企业业务测试通过。设置0后心跳没有运行，不能称“通过20多个心跳周期”。

源码核验：锁定依赖playwright-core的coreBundle.js中pingTimeout直接读取process.env该变量，非CLI配置合并链；timeout<=0跳过心跳，否则ping失败会server.close。此修复是当前DSH组合的局部兼容策略，不修改官方依赖，不宣称修复了所有404原因。

本次[Windows CI](https://github.com/stevejoeyms/ds_tmp/actions/runs/43852327389)（代码0989560）PASS：21/21原生测试、实际CLI/HTTP协议、后台启动复用与停止、Python入口、模拟Harness顺序验证。新增预加载探针只用于CI，直接观察官方CLI子进程收到心跳值0，即使父进程值为12345；父进程保持12345。探针不进入离线包。首次CI因测试预加载路径转义失败，修正测试路径后全绿；运行修复本身未改变。
