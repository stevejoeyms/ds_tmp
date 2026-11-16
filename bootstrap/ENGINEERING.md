# 便携初始化器工程约定

构建入口只使用DSH Node24，yaml来自server/node_modules/playwright-core/lib/utilsBundle；开发测试可用同仓offline-mcp目录依赖。Node原生测试：node --test bootstrap/setup.test.mjs。Windows集成由offline-mcp/build.ps1调用bootstrap/windows-check.ps1，仅使用Runner临时模拟DSHhome和实际已安装Python，不写宿主真实DSH。

核心约束：setup-core.mjs只负责纯规划与事务；setup.mjs负责探测和命令调度。初始化只能更新用户指定/确认目录中的profile patch、DSHhome AGENTS、包.local说明及备份，不改PATH/注册表/Python/策略。不执行YAML !!js。先验证全部计划再写，备份字节一致，重复执行不新增Client。服务状态只做协议，不调用浏览器工具；真实Edge Token/DSH上下文接入需目标机验收。
