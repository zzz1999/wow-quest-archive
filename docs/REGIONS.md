# 区域与任务分类名称

网页的「区域 / 分类」筛选、任务详情及复制文本使用本地名称表，搜索也可匹配区域的中文名和英文名。下拉框将区域与任务分类分组，保留编号区分同名区域。原始任务 `zoneOrSort` 不变；名称表按版本单独保存在 `data/regions/<version>.json`。

依据 [AzerothCore QuestSortID 字段说明](https://www.azerothcore.org/wiki/quest_template#questsortid)，正数指向 `AreaTable`，负数的绝对值指向 `QuestSort`，零表示未分类。任务日志的归类不等于 NPC 坐标或全部任务目标的所在地。

## 版本与来源

所有下载 URL、固定提交、构建号、字节数和 SHA-256 锁定在 `sources/regions/manifest.json`。

| 版本 | 原始名称依据 | 中文补充依据 |
| --- | --- | --- |
| 经典旧世 | Xian55/tortoise-db-viewer 提取的 1.12.1.5875 `areas`；分类名称使用 Classic Era 1.15.7.60277 `QuestSort` 参考表 | Classic Era 1.15.7.60277；相同名称可由其他参考表补充 |
| 巫妖王之怒 | wowgaming/client-data v20.0 中的 3.3.5.12340 `AreaTable.dbc` / `QuestSort.dbc` | Classic Era 与 7.3.5.26972、5.5.0.60700 参考表，须按原始英文核对 |
| 大地的裂变 | caicaicai/dbc434 固定提交的 4.3.4.15595 客户端表 | 7.3.5.26972、5.5.0.60700 及 Classic Era 参考表，须按原始英文核对 |
| 潘达利亚之谜 | alexkulya/pandaria_5.4.8 项目链接的 5.4.8.18414 客户端表，原始语言为俄语 | 5.5.0.60700 与 7.3.5.26972 参考表，须按原始俄文核对；分类亦可核对同版本核心 `QuestSort` 枚举 |
| 军团再临 | Wago Tools 导出的 7.3.5.26972 `AreaTable` / `QuestSort` | 同一构建的简中、繁中表 |

参考表使用 [Wago Tools](https://wago.tools/) 客户端 CSV。DBC 列结构取自固定提交的 [WoWDBDefs](https://github.com/wowdev/WoWDBDefs/tree/b9a63096cdd99b26967f17f9515377ae62cadfd7/definitions)。1.12 客户端提取文件来源是 [Xian55/tortoise-db-viewer](https://github.com/Xian55/tortoise-db-viewer/tree/91e7e8c757b515a90a83842a6bf886ff72e3e67b/scripts/data)，3.3.5 来源是 [wowgaming/client-data v20.0](https://github.com/wowgaming/client-data/releases/tag/v20.0)，4.3.4 来源是 [caicaicai/dbc434](https://github.com/caicaicai/dbc434/tree/33359c12c01ac9127a1d299be008a4ab38ee75d4)。

这里的怀旧服客户端只提供核对后的名称参考，不替换原版任务、区域编号或任务关系。经典旧世的任务分类使用 Classic Era 名称参考，构建号明确保留，不声称它是 1.12 分类表的逐字副本。

## 回退与匹配

1. 先选择当前版本的原始表，保持区域与分类的独立编号空间。
2. 翻译参考必须同时满足相同表、相同编号、原始语言名称相同；比较时只统一大小写、Unicode 形式与空白。不会只凭数字编号套用后期地名。例如区域 33 在经典旧世显示「荆棘谷」，大地的裂变显示「北荆棘谷」。
3. 潘达利亚分类的俄语词形不同但含义由同版本核心枚举确定时，还要求枚举常量与参考英文逐字母匹配。例如 `QUEST_SORT_BATTLEGROUNDS = 25` 对应 `Battlegrounds`，由此使用「战场」。枚举证据为固定提交的 `SharedDefines.h`，不执行该文件。
4. 合格候选按简中 → 繁中 → 英文选择。中文表中的英文占位与损坏文本不算中文；原始英文优先保留。无法核实的值显示「未收录区域 / 分类 #编号」。

每条名称记录保留 `value`（有符号原值）、`id`、`kind`、`name`、`nameLocale`、`nameSource`、`englishSource`、`base` 与 `match`。`base` 包含当前版本原始名称及来源；`match` 记录实际匹配规则与参考依据。任务详情的「原始资料」可查看名称出处。

## 覆盖情况

以下按「版本 + 非零区域 / 分类编号」计数，零值统一显示「未分类」。

| 版本 | 简中 | 繁中 | 英文 | 名称缺失 |
| --- | ---: | ---: | ---: | ---: |
| 经典旧世 | 120 | 0 | 0 | 0 |
| 巫妖王之怒 | 218 | 2 | 1 | 0 |
| 大地的裂变 | 272 | 2 | 0 | 0 |
| 潘达利亚之谜 | 321 | 3 | 0 | 0 |
| 军团再临 | 462 | 4 | 0 | 1 |

合计 1,406 个版本编号，其中 1,405 个有名称。军团任务 10559 遗留的区域 3535 不在锁定的 7.3.5 区域表内，保留未收录标记；不会把早期版本的同号地区静默当作军团表中的记录。详细统计见 `reports/region-audit.json`。

## 重建

运行 `node scripts/import-regions.mjs`（可追加版本目录名），再运行 `npm run build`、`npm test`、`npm run validate`。完整 `scripts/rebuild.mjs` 已包含名称表导入。输入缓存在 `.cache/regions/`，下载与重建会核对文件哈希。普通构建、校验与网页浏览不需要联网；网页只加载随包保存的 `web/regions-data.js`。

本功能只引用游戏名称及其来源。客户端资料仍属 Blizzard 或对应权利人，参见 `DATA-LICENSE.md`；本项目的 MIT 不覆盖这些游戏资料。
