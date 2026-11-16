# Proposal
## Why
用户已有桌面离线Python，准备把Playwright包放在同一harness目录；其他使用者需要一次初始化即可让DSH知道准确命令并挂载原生Client。
## What Changes
- 增加CMD+Node初始化和统一Python/MCP命令入口，兼容任意用户选择的目录及空格/中文。
- 探测实际Python与DSH profile，保留原配置和备份，幂等合并Client与用户全局短指令。
- 生成本机环境说明，不复制凭据、Python或企业资料到公开产物。
## Capabilities
### New Capabilities
- `portable-harness-setup`: 离线环境发现、无损注册、模型指令索引与运行入口。
### Modified Capabilities
无。
## Impact
仅新初始化器、文档及组包。复用现有官方运行依赖，不装npm/pip、不改PATH/注册表/执行策略，不自动安装扩展或登录。
