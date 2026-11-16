# 本目录的 Playwright 使用入口

本目录是 Microsoft Playwright MCP + Edge Extension 便携包，适用于网页操作、浏览器自动化、UI功能测试。

用户请求这类任务时：
1. 先读 `00-先读我-Playwright入口.md` 和 `best-practices/MODEL-INSTRUCTIONS.md`。
2. 优先使用当前已注册的 `mcp__playwright__*` 原生工具；先list/select已有标签页并读取snapshot，不重复启动Server或创建临时客户端。
3. 工具不可见才按 `Harness配置说明.md` 排查实际注册，不虚构调用成功。
4. 参数以当前schema为准，业务动作以用户授权为准；不读出或上传Token、Cookie、企业数据。

本文件仅提供本包的使用提示，不自动注册MCP、不修改权限，也不应覆盖其他工作区已有的指令文件。

日常用户启动用本包`启动Harness.cmd`，先MCP后相邻Harness，不设登录自启。初始化后Python准确路径见本机`ENVIRONMENT.md`与`.local/environment.json`，通过`tools.cmd python`调用；不要使用PATH上的python/pip。完整说明见`一键启动说明.md`。
