# 重复规则与接取条件

任务列表与详情显示重复类型和阵营，支持与关键词、区域、等级、语言、种族、职业组合筛选。详情中的“接取条件与重复规则”列出依据与限制。规则在本地执行，离线包包含所有名称和解释数据。

“可重复（全部）”包括普通可重复、每日、每周、每月、世界任务与使者任务。“联盟（含双方）”和“部落（含双方）”包含双方共有任务；“仅联盟 / 仅部落”只选取种族条件限定该方的记录。选择具体职业时包含不限职业的任务，也可单独选择“有职业限制”。种族与职业选项只包含当前版本已有的可玩种族、职业。

这是对**收录快照的静态字段**的解释，不是角色接取资格模拟器。前置任务、互斥组、声望、技能、NPC 交互、阶段、活动与脚本也会限制接取；种族和职业筛选不额外模拟可创建角色的种族 / 职业组合。阅读设置中的角色称呼与任务筛选相互独立。

## 重复类型

位值使用十进制。规则按版本独立保存，不把后期资料片的标记套用到早期版本。

| 版本 | 普通可重复 `specialFlags` | 每日 `flags` | 每周 `flags` | 每月 `specialFlags` |
| --- | ---: | ---: | ---: | ---: |
| 经典旧世 | 1 | 不支持 | 32768 | 不支持 |
| 巫妖王之怒 | 1 | 4096 | 32768 | 16 |
| 大地的裂变 | 1 | 4096 | 32768 | **4** |
| 潘达利亚之谜 | 1 | 4096 | 32768 | 16 |
| 军团再临 | 1 | 4096 | 32768 | 16 |

每日 / 每周 / 每月位本身足以标注周期，不要求源库同时写入普通可重复位；核心在加载时会补上相关标记。如果同时出现每日与每周位，按核心纠正逻辑优先每周。普通可重复不代表无限次立刻接取，只表示未指定上述周期。自动完成、分享任务、追踪任务标记不等于可重复。

军团使用固定 **7.3.5.26972** 的 `QuestInfo` 中文类型表识别世界任务与使者任务，显示“随刷新开放”，不臆定为每日重置。单有 `QuestType=3`、日常显示位或 `FlagsEx` 的旧定义位不足以确定重复规则，缺少其他证据时显示“重复性待确认”。

巫妖王、潘达利亚与军团核心的 `IsSeasonal()` 包含特定节日 / 活动分类；这类记录如无明确重复或周期位，显示“活动任务 · 重复性待确认”。档案尚未导入完整 `game_event_seasonal_questrelation` 与事件重置数据，不能一律归为一次性或可任意重复。待确认记录不进入确定的“非可重复”或“可重复”筛选。

没有上述标记的正常记录显示“非可重复”，含义是本快照没有重复标记；它仍不是对所有服务器、所有脚本行为的保证。

## 阵营、种族与职业

`raceMask` / `classMask` 使用 `1 << (ID - 1)` 的位关系，解码使用 `BigInt` 避免 32 位符号与大整数精度损失。只取本版本可玩种族、职业的位；混有未来位时不把未开放种族展示为可选。若仅含未知位，或数值无效，则标为待确认。

阵营根据允许种族所属阵营推导。未选阵营的熊猫人（ID 24）独立于联盟熊猫人（25）和部落熊猫人（26）；含未选阵营种族的记录不会误标为“仅联盟”或“仅部落”。双方种族均被允许时显示“联盟 / 部落”，这并不证明双方都能通过 NPC 与其他条件接取。

经典、巫妖王、大地裂变、潘达利亚的种族掩码 `0` 表示不限制种族。**军团固定核心的种族检查不把 `0` 当作全部种族**，因此这类记录显示“阵营待确认”；`-1` 或覆盖该版本所有可玩种族的掩码则表示种族条件不限制。职业掩码 `0` 表示不限职业。字段未可靠提供时不猜测。

军团基库有许多旧任务的掩码是 `4294967295`，即使旧版相同 ID 曾有阵营限制，也不从旧版迁移条件，不按任务名或 NPC 名猜阵营。需要更严格的资格判断时，应检查同版本服务器条件、NPC 阵营、前置与脚本。

## 来源与复现

解释规则与固定核心提交在 [sources/quest-traits/manifest.json](../sources/quest-traits/manifest.json)；其中记录原文件 URL、大小、SHA-256、源列与版本可玩 ID 范围。阅读了各核心的 `QuestDef.h/.cpp`、`SharedDefines.h`、任务加载和玩家任务检查代码。经典与大地裂变使用同客户端核心的固定提交解释数据库位语义，不声称它们与主库快照采集于同一天。

| 版本 | 核心定义 |
| --- | --- |
| 经典旧世 | [CMaNGOS Classic](https://github.com/cmangos/mangos-classic/blob/a4b8e30084a16d3c18dc00cd219699f8b30a184e/src/game/Quests/QuestDef.h) |
| 巫妖王之怒 | [AzerothCore](https://github.com/azerothcore/azerothcore-wotlk/blob/8265956f54c64ad082e2b9f8d37db64b38600b3f/src/server/game/Quests/QuestDef.h) |
| 大地的裂变 | [MaNGOS Three](https://github.com/mangosthree/server/blob/358e03bafbaa5f3e89d67843c7eced1c54b2259c/src/game/WorldHandlers/QuestDef.h) |
| 潘达利亚之谜 | [Pandaria 5.4.8](https://github.com/alexkulya/pandaria_5.4.8/blob/e0a20613d73e2b9324ac13a4783c724fec1d4559/src/server/game/Quests/QuestDef.h) |
| 军团再临 | [TrinityCore 7.3.5](https://github.com/TrinityCore/TrinityCore/blob/7f2b7dc9c2165d2608742473a931f55b1c1a753a/src/server/game/Quests/QuestDef.h) |

种族简中名称与阵营来自同样锁定的 [ChrRaces](https://wago.tools/db2/ChrRaces/csv?build=7.3.5.26972&locale=zhCN)，军团任务类型来自 [QuestInfo](https://wago.tools/db2/QuestInfo/csv?build=7.3.5.26972&locale=zhCN)，CSV 原件保存在 `sources/quest-traits/`。职业名称沿用 `sources/reading/` 的固定客户端表。这里只使用名称与已核对的 ID / 阵营关系，不借用后期任务记录。

`scripts/quest-traits-data.mjs` 校验客户端原表哈希并生成浏览器规则。`web/quest-traits.js` 在网页与构建检查中共用，**不改写**任务 JSONL；复制当前文本包含解释结果，原始 JSON / JSONL 导出保留源值。研究时可读取 `raceMask`、`classMask`、`flags`、`specialFlags`、`type` 和 `sourceFields`，再用同版本规则解释。

`npm run build` 生成 `web/quest-traits-data.js` 与 [reports/quest-traits.json](../reports/quest-traits.json)，后者统计五版本的重复类型、阵营分布、种族 / 职业限制及待确认 ID。`npm run validate` 逐版本从全部原始记录重算并核对统计。单元测试覆盖版本位差异、64 位掩码、种族阵营、条件组合和待确认规则。
