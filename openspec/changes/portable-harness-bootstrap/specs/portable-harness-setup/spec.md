# Portable Harness Setup
## Purpose
让使用离线DeepSeek Harness的Windows用户在任意自选桌面目录中，一次登记已有Python和Playwright环境并让模型知道真实可用的执行入口，同时保留原设置、凭据边界与可追溯备份，不依赖系统PATH或在线安装。
## ADDED Requirements
### Requirement: AC-01 便携发现与统一执行
初始化器 SHALL 检查实际Node和Python，支持自选含空格/中文的目录，提供保留调用工作目录的Python UTF8入口，不修改Python安装或PATH。
#### Scenario: 相邻Python
- **WHEN** Python位于本包有限父目录中的约定嵌入目录
- **THEN** 实际探测成功后记录准确解释器并通过统一命令执行参数
#### Scenario: 缺失或歧义
- **WHEN** Python不存在、无效或有多个候选
- **THEN** 明确失败并要求指定准确路径，不下载或猜测另一个Python
### Requirement: AC-02 无损幂等配置
初始化器 SHALL 合并Client与用户全局指令，保留无关内容和字节备份，重复执行不重复注册；解析失败、冲突及并发修改不得静默覆盖。
#### Scenario: 已有自定义YAML
- **WHEN** 合法配置包含注释、!!js与其他条目
- **THEN** 保留原字节并追加已验证Client，原文件有备份
#### Scenario: 冲突配置
- **WHEN** playwright已指向其他地址或条目已禁用
- **THEN** 在写入任何配置前失败
### Requirement: AC-03 本机说明与权限边界
初始化器 SHALL 生成不含凭据的本机环境说明与模型指令索引，使用DSH实际home/profile；不修改注册表、执行策略、浏览器资料或企业数据。
#### Scenario: 新会话引导
- **WHEN** DSH按已启用的指令机制加载用户全局AGENTS
- **THEN** 模型获得准确统一命令和最佳实践位置，文档要求实测而不以写入成功代替验收
### Requirement: AC-04 服务复用与真实状态
统一入口 SHALL 使用MCP初始化与工具发现确认已有服务，默认复用而不重启；缺Token或原生工具尚未注册时明确区分未完成。
#### Scenario: 已运行服务
- **WHEN** 8931上已有发布Playwright工具的MCP服务
- **THEN** 复用服务且不再启动或关闭用户进程
#### Scenario: 首次部署
- **WHEN** 无服务或本机Token
- **THEN** 提供宿主启动/本地Token配置步骤，不从模型沙箱绕过权限

### Requirement: AC-05 先服务再打开Harness
启动入口 SHALL 在MCP协议与所需工具就绪后才请求打开相邻DeepSeek Harness New/DeepSeek Harness.exe，不安装登录自启动、不强制关闭既有DSH进程。
#### Scenario: 服务尚未就绪
- **WHEN** MCP协议检查失败或缺Token尚未完成本地配置
- **THEN** 不启动Harness程序，并明确剩余步骤
#### Scenario: 服务已就绪
- **WHEN** 已发现明确的Harness程序且MCP初始化与工具发现成功
- **THEN** 请求打开该程序，保留已有服务，实际原生工具恢复仍需验收
### Requirement: AC-06 Token不冒充实机验证
初始化器 SHALL 区分本地Token可用形态与真实扩展认证，优先本地Token文件但不修改系统环境变量；不另起浏览器会话判断Token过期。
#### Scenario: 用户重新配置Token
- **WHEN** 用户在本机编辑Token并确认
- **THEN** 只重启本包有权控制的服务，其他服务保持不动，不回显Token
