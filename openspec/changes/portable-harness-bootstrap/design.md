# Design
## Context
DSH0.2.2-rc.1已确认支持用户全局AGENTS；用户桌面harness目录有独立嵌入Python3.12.8及py.cmd，无PATH/pip，工具包将放在该目录内。初始化在普通用户宿主CMD执行，模型不从沙箱启动Edge。
## Goals / Non-Goals
一次发现并登记实际路径，保留原配置与现有运行服务。不打包Python/wheels，不改Python环境、系统配置或业务数据。不承诺仅文件写入等于模型上下文/原生工具已验收。
## Decisions
CMD引导DSH Node24；Node使用随官方Playwright依赖分发的yaml解析器，仅解析不求值!!js。先规划全部变更，语义校验后保留原文件字节、追加Client insert；冲突/无法确定profile则失败。用户全局AGENTS只更新唯一标记块。所有既有文件改动先备份，原子替换并检测并发改动，失败仅回滚本次仍未被外部改动的内容。
Python从显式参数/环境变量及包目录向上有限层级中的确切python-3.12.8-embed-amd64/python.exe发现；实际执行获取版本及模块可发现性，不信任路径名或用户列表即验证。Python入口继承调用cwd并强制UTF8，不调用PATH上的python。local环境JSON/Markdown含本机路径，不含Token。任何普通路径由参数数组传递，避免shell插值。
默认复用已有8931上的真实Playwright MCP协议服务；不存在则以已有后台启动器启动，缺Token时给本地配置入口。初次扩展安装/Token/SSO仍由用户完成。启动入口先确认MCP协议就绪，再请求打开相邻DeepSeek Harness New/DeepSeek Harness.exe；不提供登录自启动快捷方式，不强关已有DSH。Desktop只接受DSH_HOME/profiles/desktop与官方base+web-app manifest，显式home传入子程序；第三方bundle或注册相关动态表达式转手动，不执行!!js。
## Risks / Trade-offs
桌面/OneDrive/中文路径→全部绝对探测，不写死桌面位置。移动目录→重新初始化更新索引。未知配置或冲突→不覆盖，不启动新服务。多个安装根→拒绝歧义，允许显式参数。原生指令机制可被profile关闭→要求新会话实测，不宣称自动加载绝对保证。备份含原设置→仅留本机。
