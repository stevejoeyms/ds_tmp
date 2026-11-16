# 常用配方：MCP0.0.85 默认25工具

这里写 raw tool 名；在 DSH 中通常加 mcp__playwright__ 前缀。参数必须对照实际工具定义。所有 e12、f1e9、index0、文字和值都是**教学占位**，不是现场观测，使用前替换成当时真实结果。JSON 只是调用参数，不是可双击运行的自动测试。

## 1. 找正确标签页

browser_tabs：`{"action":"list"}`；随后按刚才返回的索引 browser_tabs：`{"action":"select","index":0}`；browser_snapshot：`{}`。

选择后核对 URL/标题/环境，避免误选 token 新空白页或扩展状态页。仅确认已有目标不在受控范围且用户允许时，才导航或new。不要每步new，不要以页面标题相同认定页面相同。

## 2. 大页面用局部查找

browser_find：`{"text":"搜索","maxResults":5}`。它检索的是新的可访问性快照，不只是你上次保留的文本；text/regex二选一，maxResults为正整数。重名时看祖先路径，不能永远选第一项。

browser_snapshot：`{"target":"e12"}` 可观察指定已知区域；`{"depth":3}` 可粗看结构，但可能隐藏深层内容，不能证明没有控件。无需对每次动作重复拉取完整大表格。

## 3. 输入、查询、核对

browser_type：`{"target":"e12","text":"示例查询值","submit":false}`。

此工具默认填入整个文本，通常会替换旧内容，不是逐字追加。若页面依赖键盘事件且普通fill无效，再按观察选择 slowly:true；不要默认slowly。

重新确认输入值和查询按钮后，browser_click：`{"target":"e18","element":"搜索按钮"}`。

先定义业务预期，再观察返回的快照/查找结果。表格出现不代表条件生效，HTTP200也可能是旧数据或业务错误。必要时在框内先核对新值、点击后核对 loading/行值/空态。

## 4. 多字段只批量填稳定且独立的字段

browser_fill_form：
```json
{"fields":[{"target":"e12","name":"编号","type":"textbox","value":"示例值"},{"target":"e13","name":"复选框","type":"checkbox","value":"true"}]}
```

fields项需要target/name/type/value。value都是字符串；checkbox用"true"/"false"，不是布尔值。示例复选框操作必须已获准，它可能触发保存。联动字段逐个填，每次观察，不能一次批量套用初始target。combobox在此版本调用原生selectOption，不适合所有ARIA combobox。

## 5. 原生下拉与自绘下拉

原生 select：browser_select_option `{"target":"e20","values":["observed-option-value"]}`；values是数组，选择值从实际选项观察取得。

Element Plus/Vue/React自绘下拉：click已知控件 → find实际选项 → click新target → 核对已选值。ARIA role=combobox不等于HTML select；不因标签名相似就调用select_option。日期控件优先按当前UI步骤填写，不直接写DOM value跳过事件。

## 6. 等待（不能代替业务检查）

browser_wait_for：`{"text":"已观察到的完成文案","time":10}`。

browser_wait_for：`{"textGone":"加载中","time":10}`。

time在有文字时是等待上限（秒，最多30），没文字时是固定等待。不要同传text和textGone来表示“两个都完成”：本版是Promise.race，先成立一个就返回。源码文字定位是当前page的getByText(...).first()：重名时可能等错对象，也不应假设能穿透iframe；加载中文字本来就不存在时textGone可能立即成功。

iframe或特定区域的判定：优先读取其真实快照/target确认条件；原生工具不能表达所需等待时，报告限制，或按用户允许采用下面已审阅的短代码，不无限sleep。

## 7. iframe逐层处理

先 snapshot 看iframe子树和frame前缀target（例如f1e9），直接用这些真实target操作。页面仅有导航时不要立刻判空页，检查iframe是否加载、是否切错tab、是否登录过期。

需要诊断frame时，先用browser_evaluate做小范围**只读元数据**观察：
```json
{"function":"() => Array.from(document.querySelectorAll('iframe')).map(f => ({name:f.name,src:f.getAttribute('src')}))"}
```

它在页面环境执行，不存在page变量；跨源iframe的contentDocument受同源规则限制，不能用它强行读取。不要把frame的src另开页当等价测试，因为父页传参、消息和权限可能不同。

仅当用户允许并审阅后，browser_run_code_unsafe可以用下面短片段列出frame（没有外部库）：
```json
{"code":"async (page) => page.frames().map(f => ({name:f.name(),url:f.url()}))"}
```

随后以**现场已确认的frame URL**和控件语义定位，示意：
```js
async (page) => {
  const f = page.frames().find(f => f.url() === 'REPLACE_WITH_OBSERVED_FRAME_URL');
  if (!f) throw new Error('frame not found');
  const result = f.getByRole('table');
  if (await result.count() !== 1) throw new Error('table ambiguous or missing');
  await result.waitFor({state:'visible',timeout:10000});
  return {url:f.url(), tableVisible:await result.isVisible()};
}
```

上例必须先替换占位URL并核对该页面确实有一个table；它只验证可见，不验证查询业务正确，也未在企业页面实测。不要把未渲染的虚拟行、隐藏表格或多个嵌套frame随便first()。

## 8. 截图与轻量诊断

browser_take_screenshot：`{"scale":"css","filename":"evidence/case-01.png","fullPage":false}`。scale在真实schema是必填，即使文案写默认css。证据区域截图可加真实target，但不能与fullPage:true组合。

browser_console_messages：`{"level":"error","all":false}`。

browser_network_requests：`{"static":false,"all":false}`。static在本版schema必填。输出是1起始的请求索引，browser_tabs是另一套索引，不能混用。fullPage也不能展开虚拟列表中未渲染的数据。

只在定位所需请求且已获准时，browser_network_request可取 `{"index":1,"part":"response-body"}`。index必须来自刚才的列表；响应体仍可能含企业敏感数据，不取完整headers/Cookie/Token，不把响应当UI结果的替代证明。

## 9. 文件到底落在哪

snapshot/screenshot等工具的相对filename由**Server所识别的workspace root**解析，不是模型嘴里说的当前目录。rc.1 Client源码声明capabilities:{}，不能假设它提供MCP roots；当前后台Server cwd为server目录，因此需先根据实际工具返回的保存路径确认位置。也可能受允许根目录限制而拒绝绝对路径。

首次获准保存一个小证据文件后，记录工具返回的实际路径；不要仅凭猜测写“已保存到ds-test”。不要启用allow-unrestricted-file-access来绕过路径错误。

## 10. 真实业务验证

同一用例按“前提 → 输入 → 动作 → 预期 → 实际 → 结论”执行。搜索测试至少核对筛选值与结果行字段；分页至少核对页码和记录变化；没有已知预期只能探索，不能编造PASS。

默认没有browser_verify_text_visible / browser_verify_value；不要凭记忆调用。--caps=testing是可选能力，不是本包默认配置；如未来明确启用，先重新读取工具列表。也没有自动导入expect的测试运行器，不要写expect(...)后假设它存在。

## 11. 弹窗和下载

原生alert/confirm/prompt用browser_handle_dialog；页面DOM弹窗用快照中的按钮，两者不同。`{"accept":false}`只是格式示例，dismiss也可能改变流程，应按用户授权与当前弹窗处理，不能对所有弹窗自动accept。

下载按钮点击后可能启动导出任务、打开新tab或下载文件。先明确用户批准与预期文件内容，核对实际下载事件/工具返回文件位置及适当的内容依据；按钮点击成功不算文件已下载。审批式导出不列为默认只读动作。
