# 任务中的称呼与数量

玩家视角把可以确定的原文标记显示为具体文字或数字，沿用绿色小标签。原文视角、英文对照、JSON / JSONL 不改写。规则核对日期：2026-10-18。

| 标记 | 展示方式 | 依据与限制 |
| --- | --- | --- |
| `$N` / `$n` | 玩家名字 | 来自阅读设置；未填写显示“名字” |
| `$p` | 玩家名字 | 在当前收录的任务对白中作为玩家称呼，与 `$n` 使用同一阅读设置；不解释为宠物名字 |
| `$C` / `$c`、`$R` / `$r` | 玩家职业、种族 | 来自阅读设置，保留英文大小写规则 |
| `$ct` | 职业领袖头衔，例如“大法师”“大德鲁伊” | 军团使用 7.3.5.26972 `ChrClassTitle`，按玩家职业及性别取值 |
| `$vn` | 职业对应的敌对角色名字 | 军团使用同 build 的 `ChrClassVillain`，例如法师对应“玛克扎尔” |
| `$vg男称呼:女称呼;` | 上述敌人的性别称呼 | 使用 `ChrClassVillain.Gender`，不是玩家性别 |
| `$1oa`、`$2oa` 等 | 对应任务目标所需的数量 | 来自当前版本当前任务的 `objectiveDetails[].amount`，不是玩家已完成的数量 |
| `$oa` | 当前目标所需的数量 | 目标说明中使用当前目标；任务正文只有一个目标时可确定，否则保留说明 |
| `$G男称呼:女称呼;` | 玩家性别称呼 | 根据阅读设置选择，未选择时并列展示 |
| `$数字w` | “服务器实时数值” | 离线档案没有服务器实时状态，不用快照默认值冒充实时进度 |
| `$T...:...;` | “玩家军衔” | 档案未保存玩家 PvP 军衔 |

职业可在阅读设置中选择或输入，支持客户端简中、繁中、英文职业名称。明确填写的职业优先；未填写时仅在任务 `classMask` 限定单一职业时推导。没有职业信息时，显示“职业头衔”“职业对应的敌人”并说明如何设置，不任意假定为法师或选择一个 NPC。

## 可核对的例子

- `legion:9065`：阅读设置为法师时，描述中的 `$ct` 显示“大法师”，`$vn` 显示“玛克扎尔”，`$vg他:她;` 显示“他”。这三个值与交付任务的“坎瑞薩德”无关；选择德鲁伊则显示“大德鲁伊”和“提克迪奥斯”。
- `legion:40861`：`$1oa` 显示 **10** 个便携式洒弹器零件。
- `legion:31737`：第一个目标需求 **10**，第二个需求 **5**，不能把两个数量混用。
- `legion:46251`：收集 **2500** 块虚空碎片；该目标的存储索引是 `-1`，仍可由唯一目标确定数量。

## 证据与可复现数据

普通玩家变量参照 [AzerothCore 字段说明](https://www.azerothcore.org/wiki/quest_template#questdescription)。职业表来自 Wago Tools 按 **7.3.5.26972** 导出的客户端 DB2 数据：

- [ChrClasses 简中](https://wago.tools/db2/ChrClasses/csv?build=7.3.5.26972&locale=zhCN)
- [ChrClassTitle 简中](https://wago.tools/db2/ChrClassTitle/csv?build=7.3.5.26972&locale=zhCN)
- [ChrClassVillain 简中](https://wago.tools/db2/ChrClassVillain/csv?build=7.3.5.26972&locale=zhCN)

三张表各保存简中、繁中和英文原始 CSV，下载 URL、字节数和 SHA-256 在 [sources/reading/manifest.json](../sources/reading/manifest.json)。网页生成时先校验全部哈希，再按简中 → 繁中 → 英文选择各字段。`scripts/reading-data.mjs` 生成离线 `web/reading-data.js`；浏览器运行不访问 Wago。这里的名字属于客户端游戏数据，适用 [DATA-LICENSE.md](../DATA-LICENSE.md)，不属于本项目 MIT 工具授权。

表结构可交叉核对 [WoWDBDefs ChrClassTitle](https://github.com/wowdev/WoWDBDefs/blob/b9a63096cdd99b26967f17f9515377ae62cadfd7/definitions/ChrClassTitle.dbd)、[ChrClassVillain](https://github.com/wowdev/WoWDBDefs/blob/b9a63096cdd99b26967f17f9515377ae62cadfd7/definitions/ChrClassVillain.dbd)。`$ct` 在军团职业任务中的用法也见 [TrinityCore 7.0 任务采集](https://github.com/TrinityCore/TrinityCore/blob/f7cac245da88185d632c682983bd8c33cac34089/sql/old/6.x/world/04_2016_10_17/2016_09_03_00_world.sql)。

**证据层级：** 表里的具体名字、称号、职业 ID、性别是保存的客户端数据；`$ct` / `$vn` / `$vg` 与这些表的对应关系是依据标记形式、表结构和任务上下文形成的阅读解释，`$p` 的玩家称呼解释同样来自原始对白上下文。没有取得暴雪客户端文本解析器源码，也没有把这些规则作为客户端实机验证结果。解释保留在展示层，不写入任务原文或替代任务 NPC 关系。7.3.5 的职业表不会用于潘达利亚等其他版本的同名标记。

## 数量与未确定内容

旧快照的 `objectiveDetails.order` 来自 `StorageIndex` / `Index`，不能一律当作数组下标。连续且唯一的零起始索引按目标顺序解析；只有一个目标或候选目标的数量完全相同时，数量也可唯一确定。重复、缺号、非零起始且数量不同的目标暂不猜选；无编号 `$oa` 在多目标正文中也不猜选。规则旨在覆盖可确定的普通任务，并非模拟所有客户端目标索引规则。目标数据表说明见 [TrinityCore quest_objectives](https://trinitycore.info/database/master/world/quest_objectives)。

当前选中任务文本中，无需角色设置即可处理 **651 处目标数量**（军团 614、潘达利亚 37）与 **163 处 `$p` 玩家称呼**。军团还有 **40 处 `$ct`** 等待职业设置；同版本的 `$vn` / `$vg` 各一处也可随职业设置解析。完整统计与未解析位置在 [reports/reading-audit.json](../reports/reading-audit.json)，可运行 `node scripts/audit-reading.mjs` 重现。

尚未核实的 `$cy`、测试文本中的 `$1oo` / `$o1x` 等显示为“待核实：原标记”，保留具体字符；不再把不同内容统一掩盖为“特殊变量”或“游戏变量”。没有足够依据的动态值仍不会编造。复制当前文本使用相同展示规则；已确定的值直接复制，未确定值附带原标记。
