# 数据字典与导入边界

`data/<version>/*.jsonl` 按 UTF-8 存储，一行一个任务对象。任务主键是 `key = version + ':' + id`。不同版本的同 ID 记录始终分开，后一个版本通常还保留早期版本任务。NPC 与物件另存于 `data/<version>/actors/*.jsonl`。

| 字段 | 含义 |
| --- | --- |
| `schemaVersion` | 当前为 1 |
| `version`, `id`, `key` | 版本、源任务 ID、稳定版本主键 |
| `text` | 按简中、繁中、英文逐字段选出的文本 |
| `textLocales` | 每个选中字段的实际语言；缺失为 null |
| `textColumns` | 字段来自哪个上游表、列；列名统一小写 |
| `textSources` | 每个选用字段的来源 ID；主库为版本 ID，补充库为该版本 `manifest.supplements[].id`，缺失为 null |
| `textMatches` | 补充字段与主库的英文匹配依据；只比较，不改写原文 |
| `englishSources` | 英文对照的逐字段来源；主库原有英文保持原样。主库缺失时，采用补充译文所属来源的英文，可能替换先前补充库的英文对照 |
| `textBuilds` | 对应原始 VerifiedBuild / WDBVerified（源未提供为 null），不是任务所属资料片 |
| `textIssues`, `qualityNotes` | 上游损坏字符的字段记录、已确认的译文待核说明；有替代文本时继续回退 |
| `english` | 同版本基础英文及可用 enUS 本地化原文，用于对照 |
| `level`, `minLevel` | 任务等级与最低等级；-1 等特殊值原样保留 |
| `zoneOrSort` | 原始区域 / 分类 ID；负值通常表示任务分类，网页不猜测地区名称 |
| `type`, `suggestedPlayers` | 源任务信息类型与建议人数 |
| `raceMask`, `classMask` | 原始种族 / 职业位掩码；不同客户端位定义可能不同 |
| `flags`, `specialFlags` | 原始任务标志，不能跨版本直接解释 |
| `links` | 前置、后续、奖励后续、互斥组与引导字段；保留正负号和零 |
| `starters`, `enders` | 静态接取 / 交付关系中的 NPC 或物件，含档案 `key`、`kind`、名称、名称语言和 ID |
| `objectiveDetails` | 使用独立目标表的版本，其目标类型、对象、数量、顺序、文本与语言 |
| `sourceFields` | 原表与 addon 表剩余非零、非空字段；包含奖励物品、金钱、条件等。是稀疏补充，不是可恢复整个数据库的完整备份 |
| `tags` | 缺标题、缺描述、疑似测试/废弃/占位、已知社区自定义等标记 |
| `source` | 对应版本的 manifest 与 sources/manifest.json 条目 |

`text` 包含 `title`（标题）、`objectives`（目标摘要）、`description`（接取描述）、`progress`（进行中 / 交物品对白）、`completion`（奖励 / 完成对白）、`end`（区域提示）、`completed`（完成日志）、角色窗口文本及四个旧式目标说明。缺失数据保留空字符串，不猜测、翻译或生成对白。

## 语言回退

每个字段独立执行 `zhCN → zhTW → enUS`，而不是按整条任务选择语言。空字符串、纯空白不作为有效翻译；标为中文却不含汉字的占位英文也不计为中文，优先尝试繁中与基础英文。若只有本地化表中的英文文本，则保留它并标为 enUS。

这只是可复现的语言筛选规则，不是人工翻译质量验收。不进行繁简转换，不把后续版本文本静默覆盖早期版本。繁中和英文的实际采用情况均可由 `textLocales` 检查。

### 同版本多源补充

每个版本保留一个主库，另锁定同客户端版本的补充库：经典旧世使用 MaNGOS Zero，巫妖王之怒使用 CMaNGOS WotLK，大地的裂变使用 Firelands，潘达利亚使用 SkyFire 5.4.8 和 MaNGOS Four，军团使用 LegionCore 7.3.5、The Legion Preservation Project TDB735.25051 和 Legion Proyect。来源、固定提交、附件哈希、许可和导入顺序在 `sources/manifest.json` 的 `supplements` 中。

规则 `same-version-english-anchor-v1`：

1. 只处理主库已有的 `version:id`，不会添加补充库独有任务，也不会从不同版本搬用同 ID 的文本。已标记的社区自定义任务不参与补充。
2. 主库与补充库必须有相同且非空的英文标题。标题之外，主库有对应英文时，要求该字段英文相同；主库没有对应英文时，要求非空的英文描述或目标摘要相同。
3. 仅为匹配比较做 Unicode NFKC、空白折叠及大小写归一；存储的文字和游戏变量保持原样。这是保守的自动匹配依据，不是对中文翻译正确性的证明。
4. 按简中、繁中、英文选择；同一种语言优先主库，然后按补充源的声明顺序。已有简中不会被另一份简中覆写。若对应英文内容冲突，跳过补充候选。
5. 只补充 `text` 字段及其语言、表列、build、来源信息，并在必要时补齐英文对照。等级、奖励、任务关系、NPC / 物件关系和档案仍来自原主库。
6. 新增的三个中文来源使用 `allowedLocales: ["zhCN", "zhTW"]`，不额外补入英文。军团两份新快照设置 `maxVerifiedBuild: 26972`，解析后逐表剔除 build 绝对值超过上限的行，再做匹配。build 0 或未提供 build 只表示缺乏已核实的采集版本，仍作为社区资料保留，不构成原版保证。

网页“原始资料”列出每个字段实际采用的数据库；JSON / JSONL 的 `textSources` 与 `textMatches` 保留同样证据。`reports/text-audit/<version>.json` 记录补充前后覆盖、候选匹配/拒绝数量以及每个采用字段的任务 ID、来源、语言变化和匹配依据。没有匹配到文本仍保留为空；部分自动任务、测试记录或可选对白本来就可能没有内容。

来源数量不等于独立采集证据：CMaNGOS Classic / WotLK 的中文文件同源，其他社区库之间也可能共享早期数据。dufernst/LegionCore 的 README 明示核心源自 UWOW 2020 泄露版本，Legion Proyect 也具有 LegionCore/UWOW 派生背景；本库单独记录社区来源，不将其作为官方采集或独立权利授权。dufernst 快照只提供补充英文，后加入的两个军团来源提供简繁中文。

保留 `$N`、`$C`、`$R`、`$G...;`、`$B` 等客户端变量和格式标记。JSONL 和 JSON 导出始终保留原字符串。SQL 的引号和转义按字面值解码，不执行任何 SQL。

### 网页阅读视角

网页默认“玩家视角”，只在展示层代入角色称呼：`$N` / `$n` 为名字，`$C` / `$c` 为职业，`$R` / `$r` 为种族；留空时分别显示“名字”“职业”“种族”小标签，填写后显示对应的角色资料。标签沿用语言徽标样式，悬停说明保留原始变量；只标记实际变量，正文中原本出现的“名字”等文字不加标签。职业与种族的大小写形式对英文称呼采用首字母大写 / 小写。`$G男称呼:女称呼;`（含小写 `$g`）按阅读设置选择分支；未指定时并列显示。`$B` / `$b` 和字面量 `\n` 显示为换行。规则参照 [AzerothCore 字段说明](https://www.azerothcore.org/wiki/quest_template#questdescription) 和 [TrinityCore 字段说明](https://trinitycore.info/database/335/world/quest_template#questdescription)。

“原文视角”保留全部变量及格式标记。英文原文对照保留角色变量，仅排版换行。玩家视角的特殊变量使用小标签，并提供可展开的“游戏变量说明”：数字世界状态（如 `$4022W`）显示“实时数值”，军衔标记显示“军衔”；未知标记显示“游戏变量”。`$ct`、`$cy` 等完整标记不拆成普通职业/种族变量，其具体含义尚未核实。`$vg他:她;` 等未核实对象的条件分支，以及带 `:r` / `:c` 语法引用的分支并列展示，不依据玩家性别猜选。格式不完整的性别分支仍按原样显示。这是阅读辅助，不模拟完整客户端，也不声称已知所有客户端标记。

角色设置只存储在浏览器本地，切换视角不修改任务记录、筛选或书签。“复制当前文本”使用当前视角的纯文本并标明是否代入称呼，不包含标签 HTML；特殊标签附带 `〔原始标记〕` 方便追溯。结构化导出、原始资料详情和磁盘上的 JSONL 不受影响。人物称呼设置不代表该角色满足任务的种族、职业或等级条件。

## NPC 与任务物件档案

只收录任务 `starters` / `enders` 引用的 NPC（`kind=creature`）和物件（`kind=gameobject`）。档案由同版本模板与本地化表生成，不从任务正文猜测人物身份。主键为 `version:kind:id`，因此相同数字的任务、NPC、物件以及不同版本对象互不混合。

| 字段 | 含义 |
| --- | --- |
| `schemaVersion`, `version`, `kind`, `id`, `key` | 格式版本 1、客户端快照、对象类型、模板 ID 与完整主键 |
| `name`, `nameLocale` | 选用名称及实际语言 |
| `subname`, `subnameLocale` | 模板的独立称号与语言，不拆解名称制造称号 |
| `english.name`, `english.subname` | 同版本英文名称与称号 |
| `textColumns`, `textBuilds`, `textIssues` | 名称 / 称号的来源列、采集 build、损坏字符记录 |
| `minLevel`, `maxLevel` | NPC 模板等级范围；源未提供及物件为 null，不能据此推断玩家接任务等级 |
| `templatePresent` | 是否找到对应基础模板；关系存在但模板缺失时明确为 false |
| `starts`, `ends` | 当前版本中可接取 / 可交付的任务 ID 数组，去重并排序 |
| `source`, `sourceFields` | 来源版本索引，以及模板中已保留的名称、等级、类型、阵营与 NPC 标志原值 |

名称与称号**分别**按 `zhCN → zhTW → enUS` 回退，原文和来源字段保留。各数据库的 `subname` / `title` 会映射为独立称号；女性 / 备用名称字段不覆盖主名称。不补写人物传记、坐标或动态对白。经典旧世 NPC 197 的名称为“治安官玛克布莱德”，模板没有独立称号，故 `subname` 为空。

档案 `starts` / `ends` 与任务 `starters` / `enders` 双向校验。档案列出所有静态关联，包括明确标识的测试 / 自定义任务；不受任务列表默认隐藏这些记录的筛选影响。军团有 29 个任务物件关系缺少基础模板，其档案保留 ID 与关系、名称留空。

每个版本的 `manifest.actors` 记录 NPC / 物件数量、字段语言统计及 JSONL 分片哈希。网页包在 `web/actors/<version>.js`，按需加载，不改变离线使用方式。

## 版本与完整性

- 所有来源都锁定具体 commit 或发布附件，并记录文件哈希。这是明确的**基础快照**，不是安装完整服务器并运行所有迁移后导出的数据库。
- 标题、描述、进行中和完成对白的覆盖率分别统计于 `reports/coverage.json`。有中文标题不等于中文叙事完整；任务行数也不等于可游玩任务数。
- 多源补充检查及局限见 [第一轮文字检查报告](TEXT-AUDIT.md) 和 [第二轮中文补充报告](CHINESE-TEXT-AUDIT.md)。来源不同不意味着互相独立，自动匹配不能代替逐句人工审校。
- CMaNGOS 的中文文件含部分不属于经典基库的 ID；只合并基础 `quest_template` 已有任务。
- 大地的裂变采用 MaNGOS Three 4.3.4 独立快照。其任务 2 简中描述 / 目标使用旧地点，与同库英文不一致；记录标记为 `translation-review` 并在网页提示。其他译文未全面人工核验，不能因为来自同版本仓库就假定内容完全匹配。
- 潘达利亚基库与补充本地化表来自同一个仓库与固定提交；所有补充文本任务 ID 均存在于基库，但部分中文 `VerifiedBuild` 晚于 18414。因此是社区 5.4.8 适配资料，不是经验证的原版 18414 文本全集。
- 潘达利亚 116 条社区自定义任务依据上游自定义 NPC 的接取与交付关系共同标记。证据和精确 ID 位于 `sources/pandaria-custom-quests.json`。它们仍在 JSONL 内，网页默认隐藏。
- 军团主库 TDB735.00 的进行中 / 完成对白本地化表为空；中文来自后加入的同版本补充库，其中大量 build 为 0。仍有英文回退和空白，不能根据标题覆盖率推断全部对白已汉化。
- `suspected-test` 按标题关键词启发式标记，会有漏检或误判；`community-custom` 仅涵盖已核实的特定记录，未标记不等于已证明官方原版。
- 任务关系由静态字段构建；负值前置条件、互斥组、脚本、阵营、阶段变化都会影响实际流程。网页展示关系线索，不保证是唯一线性顺序。
- 不包含完整游戏脚本、动态 NPC 对话、演出、过场、掉落概率、运行时可接条件或世界坐标复原。奖励与条件 ID 保存在 sourceFields；未把所有 ID 解析为名称。

## 复现

普通使用者不需要构建：直接打开根目录 `index.html`。

维护者需要 Node.js 20+，解压工具（Windows 内置 tar 可处理 ZIP；军团 7z 附件需要 7-Zip）。以下操作仅下载、读取和转换数据，不启动游戏服务器、数据库或执行上游脚本：

```sh
node scripts/rebuild.mjs             # 下载固定源并重建全部版本
node scripts/rebuild.mjs classic     # 只重建指定版本
node scripts/build-web.mjs           # 由现有 JSONL 生成浏览器压缩数据包
npm test
npm run validate
```

原始下载缓存到被 gitignore 排除的 `.cache/`。下载哈希不匹配时停止，不静默接受新版附件。重建完成后必须重新生成网页包并校验，不要手改 web/data/ 的压缩内容。
