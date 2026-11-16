# 桌面便携版：先 MCP，后 DeepSeek Harness

## 目录怎么放

可以放在用户熟悉的任何可读写桌面目录，不写死账号或OneDrive路径。例如：

```text
用户自选目录/harness/
  DeepSeek Harness New/
    DeepSeek Harness.exe
  python-3.12.8-embed-amd64/
    python.exe
    Lib/site-packages/
  py.cmd
  wheels/
  playwright-edge-dsh-offline-win-x64/
    启动Harness.cmd
    开始使用.cmd
    tools.cmd
    setup.mjs
    server/
    extension/
    best-practices/
```

本ZIP不重复携带Python、47个库、wheel仓库或Harness软件；使用你已经准备好的离线目录。解释器按实际执行探测，已装库登记可发现性与metadata，不把用户提供的版本列表当成47项import/业务验收结果。不会修改py.cmd、._pth或site-packages，不会调用不在本包中的旧install_wheels.py。

包可以有少量嵌套层；初始化器只检查包目录向上有限层级中确切的Python/Harness路径，不扫描全盘。发现多个候选或找不到时使用文末显式参数，不猜测路径。

## 每次只做一件事

在**沙箱外、普通用户桌面环境**运行 `启动Harness.cmd`（首次用`开始使用.cmd`也一样）。它依次：

1. 找到DSH现有Node24、相邻Python3.12 x64和Harness程序；检测实际DSHhome/profile。
2. 校验并备份必要配置，幂等追加rc.1官方MCP Client；在DSHhome的AGENTS.md中只更新本包标记块，保留其他规则。
3. 登记本机绝对路径到包内`.local/environment.json`和`ENVIRONMENT.md`，让模型知道准确执行入口。
4. 若MCP已经能初始化并发布Playwright工具，直接复用；否则在普通用户环境启动本包后台Server。
5. 缺Token时打开本地记事本：从Edge扩展复制Token值，粘贴、保存，再回终端按Enter继续；不要把Token粘进聊天或终端。
6. 只有MCP协议就绪后才请求打开`DeepSeek Harness New/DeepSeek Harness.exe`。

**不设置登录自启动，不建Windows服务，不改PATH、注册表、执行策略或沙箱权限。** 不是绕过策略；公司若禁止CMD、Node或文件写入，应报告阻塞并走批准流程。

Edge扩展首次安装和网站SSO仍由用户完成：在Edge加载本包`extension`文件夹，在该资料中登录。不要指定新user-data-dir。MCP协议就绪不证明扩展Token有效或企业页面已可控；首次真实原生浏览器调用才验证这些。

若DSH早已打开且Client重试已耗尽，重新点击启动脚本不保证现有进程的Client重载。脚本不强杀DSH；在MCP已就绪后按实际可用机制重新加载Client，或正常退出DSH主进程再打开。新建会话不等于重新挂载Host级Client。

用户登录Startup也不保证严格启动顺序，所以本方案只靠启动脚本的“就绪检查→启动请求”，不靠固定等待秒数或启动项先后。

## 模型为什么会知道

rc.1标准preset启用`dsh-agent-instructions`，首次请求读取DSHhome的AGENTS.md。初始化器只写一个短索引：准确工具路径、Python命令、原生Playwright用法及最佳实践位置；不把整套手册塞进上下文。

配置层级：
- 实际profile `cordis.patch.yml`：真正挂载官方Client；原文保留、修改有字节备份。
- `$DSH_HOME/AGENTS.md`：只更新 `DSH-OFFLINE-KIT` 标记块，指引模型使用本机入口。
- 本包 `.local/environment.json` / `ENVIRONMENT.md`：实测路径和模块可发现性，不含Token。

这些接入信息需要写入DSH自己的配置目录；Python/工具文件仍留在桌面。原配置异常、重复/冲突或已有禁用项会在写入前报错，不自动覆盖。所有本机文件/备份都不要上传公开GitHub。工作区沙箱可能限制模型写入这些目录，所以初始化由用户在宿主环境执行。

默认支持DSH0.2.2-rc.1的官方Client配置。若实际版本不明、profile被自定义或指令机制被关闭，不能仅凭文件存在声称模型已读；先核本机事实，必要时显式提供profile路径/手动合并。

## 统一命令（无需PATH上的python）

在包目录CMD中：

```bat
tools.cmd doctor
tools.cmd python your_script.py
tools.cmd python -c "import pandas as pd; print(pd.__version__)"
tools.cmd mcp status
tools.cmd mcp start
tools.cmd mcp stop
```

在其他工作区PowerShell中，引用包的完整路径：

```powershell
& 'C:\你的目录\harness\playwright-edge-dsh-offline-win-x64\tools.cmd' python '.\your_script.py'
```

Python使用实际发现的解释器，启用UTF-8并保留**调用时的工作目录与参数、退出码**。不自动cd到包目录，不借用另一个Python。库导入名不同于发行包名：PIL/pillow、docx/python-docx、pptx/python-pptx、bs4/beautifulsoup4、fontTools/fonttools；以实际import为准，缺库报告，不联网pip/npm安装。

`doctor`检查Python可执行、模块可发现性、本机索引及MCP握手/工具枚举，不调用浏览器，不读出Token，不声称模型上下文或页面测试通过。

## Token缺失、失效、换资料怎么办

Token来自**当前Edge资料的官方扩展**，不是API Key或HTTP Header。首次由启动脚本引导；后续可运行 `重新配置Token.cmd`，粘贴到本地记事本、保存、按Enter。它只停止/重启当前包路径持有的服务；遇到别处启动的服务会提示用户在原窗口处理，不按PID盲杀。

本统一入口优先使用非空单行的本地Token文件；没有有效本地值才使用环境变量。它只调整自己启动子进程的环境，不修改系统/用户永久环境变量。旧的`server/mcp.cmd`入口仍按原逻辑优先环境变量，推荐统一使用新的启动脚本。

**Token没有在本方案中被假设成有固定有效期。** 文件存在/格式正常/MCP tools/list成功都不等于Token与Edge匹配。真实连接失败可能来自Token、资料、扩展禁用、浏览器未启动或权限，不能把所有30秒超时都判为“过期”。重新核对扩展界面的值与实际资料；不为检测Token另起一次性浏览器会话，避免新增tab/client。

## 移动目录、特殊路径或检测不到

移动工具包/Python/Harness后重新运行初始化，更新本机绝对路径索引。不必把桌面位置写进公共包。

```bat
set "DSH_NODE_EXE=C:\实际DSH运行时\node.exe"
tools.cmd setup --python "D:\我的harness\python-3.12.8-embed-amd64\python.exe" --harness-exe "D:\我的harness\DeepSeek Harness New\DeepSeek Harness.exe" --dsh-home "C:\实际DSHhome" --profile-dir "C:\实际活动profile"
tools.cmd launch --harness-exe "D:\我的harness\DeepSeek Harness New\DeepSeek Harness.exe"
```

命令里的路径仅是语法示例，替换成实机路径。`setup --no-start`可只登记配置，不启动程序；`launch --no-start`只允许复用已就绪服务，不会在服务不可用时打开Harness。重复初始化应为无修改；只有路径/实际事实改变才更新本包标记块和本机说明。

恢复时先停止相关修改动作，对照同目录`.bak-...`字节备份，只恢复确认需要的那份；不要覆盖初始化后其他人新增的配置。若遇并发改动，初始化器会保留外部内容并指出需人工核对的文件。

## 最终验收

重启DSH并新建会话，要求模型：
1. 说出已加载的本机工具入口，不再猜Python路径。
2. 用统一Python入口输出真实解释器/版本和UTF-8中文，按需实际import目标库。
3. 确认原生`mcp__playwright__browser_tabs` / `browser_snapshot`存在，连续读取同一目标tab，连接和页面不无意增长。

脚本写入成功、程序被请求打开、协议tools/list成功，都不单独等于上述验收通过。本机真实DSH上下文、Edge Token/SSO及企业页面仍需实机验证。

## 配置支持边界

自动接入限定官方DSH 0.2.2-rc.1标准Desktop manifest（package.json中按顺序选择dsh-base、dsh-web-app）。需先正常打开一次Harness生成profile，再完全退出。Desktop固定使用DSH_HOME/profiles/desktop，不能用任意profile替换；显式--dsh-home会传给本次启动的Harness，不修改系统环境变量。自定义bundle、影响注册的动态配置或继承层已有Playwright Client会停止自动合并，保留现状交由人工确认。仅注释提及cordis.patch.yml不视为配置确认。官方安装包内标准bundle以固定版本官方源码为基线；手改过应用内bundle的部署需人工接入，不能当作标准安装。
