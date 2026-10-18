# 离线奖励物品提示框

悬停物品图标或用 Tab 聚焦，可查看品质、装备位置、基础物品等级、护甲、武器伤害与速度、属性、插槽、耐久、需求、效果和售价。点击图标固定提示框，手机也可点击查看；点击关闭、页面空白处或按 Escape 收起。物品名称仍是 Wowhead 外链。

所有提示文字和图标均在下载包中。`web/items/<version>.js` 是按版本压缩的本地数据，`web/icons/` 保存 JPEG 图标；页面不加载 Wowhead 的远程 tooltip 脚本，不在查看物品时请求第三方资源。首次在线打开版本仍需要下载本站对应文件；完整下载并解压后可离线查阅。

## 档案与来源

物品标识为 `version:item:id`。只收录任务固定物品、任选物品和奖励包候选所引用的物品，共 37,757 份版本物品档案；不是全部游戏物品图鉴。每 1,000 条一个 UTF-8 JSONL 分片，位于 `data/items/<version>/`，清单位于 `data/items/<version>-manifest.json`。缺少模板的引用也保留，以便审计。

| 版本 | 档案数 | 模板已收录 | 图标映射已收录 | 物品和客户端数据 |
| --- | ---: | ---: | ---: | --- |
| 经典旧世 | 2,138 | 2,138 | 2,138 | 原有 CMaNGOS 物品 / 法术表；Xian55/tortoise-db-viewer 固定提交的 `cmangos-dbc.json`、`spell-lookups.json` |
| 巫妖王之怒 | 5,051 | 5,051 | 5,050 | 原有 AzerothCore 物品表；wowgaming/client-data v20.0 的 3.3.5.12340 客户端表 |
| 大地的裂变 | 8,656 | 8,656 | 8,655 | 原有 MaNGOS Three 物品表；caicaicai/dbc434 的 4.3.4.15595 客户端表 |
| 潘达利亚之谜 | 8,826 | 8,826 | 8,824 | 原有 5.4.8 物品表；该项目 README 链接的 Data.zip 中 5.4.8.18414 客户端表 |
| 军团再临 | 13,086 | 13,036 | 11,905 | Wago Tools 的 7.3.5.26972 `Item`、`ItemSparse`、`ItemEffect`、`Spell` 等表 |

原始 URL、固定提交 / build、ZIP 成员信息、字节数、SHA-256 均在 [物品来源清单](../sources/items/manifest.json)。大型 ZIP 只通过精确 HTTP Range 获取所需成员，不下载地图或运行上游程序。WDBC 结构使用固定版本 WoWDBDefs，检查魔数、字段数、记录长度、字符串边界及重复 ID。5.4.8.18414 的 SpellMisc 沿用 18291 的 26 列布局，并用同版本核心 `DBCStructure.h` 的 SpellMiscEntry 单独核对。

经典数据来自该查看器提交的 CMaNGOS 客户端提取结果和公共查找表，不使用其 Turtle 专属物品表。所有客户端数据仍是社区保存的副本，不视为官方完整性证明。潘达利亚的数值和图标表可用，但该包的法术说明只有俄文，因此没有把俄文标成英文，也没有搬用其他版本的说明。军团名称、说明按简中 → 繁中 → 英文逐字段选择。

早期版本通过 DisplayID 查同版本 ItemDisplayInfo 的图标名；军团通过 Item.IconFileDataID 和 wowdev/wow-listfile 的 202610172315 清单找文件名。按已知文件名从 Wowhead/ZAM 图标 CDN 保存图片，去重后共 3,535 张，包含默认问号图标。每张图片的 URL、大小、SHA-256 见 [图标清单](../sources/items/icons.json)。图像是采集时的公开图标版本，不声称其像素与历史客户端完全一致；缺少映射时使用本地默认图标。

## 数值与效果边界

- 经典与巫妖的护甲、伤害、属性优先使用原始物品表；保留多段不同伤害类型。裂变、潘达利亚和军团按各自版本的 ItemArmor / ItemDamage 表、品质、部位和基础物品等级换算护甲、伤害。
- 军团固定属性按同版本 RandPropPoints、品质、部位及 StatPercentEditor 分配值计算。非零插槽成本系数缺少对应换算表时显示“数值暂未收录”，不错误当成 0 或忽略成本。
- 原始效果说明保存在 `effects[].rawDescription`。常用 `$s`、`$m`、`$M`、`$d`、`$t`、`$o` 等按同版本效果、持续时间和周期字段解析；区间保留为区间。依赖角色等级、法术缩放或复杂条件的值明确标注；不使用 eval 或执行来源中的表达式。
- 缺少可用说明时，仅对已确认的数值效果提供中文字段说明，例如攻击强度、属性、周期回复、伤害；这是界面解释，不是游戏原文译文。无法解释的效果保留法术引用并注明缺失，不把未知效果显示为“没有效果”。
- 不模拟角色装备后的总属性、职业 / 专精转换、随机词缀、宝石、附魔、套装组合、升级、世界任务物品等级、神器能量、服务器修正或脚本。套装物品和随机物品有提示，不能把当前模板当作实际获得的最终物品。
- 冷却时间采用物品记录中的使用与分类冷却；源使用 -1 指向法术默认冷却时，不补造秒数。使用次数和消耗方式来自原始 charges 字段。

`nameSource` 保留名称出处；`sources.fields` 记录字段表 / 列 / 行，计算属性的 `basis` 保留表、行、分配值和规则。`raw` 保留非空原始物品字段；客户端字段来源通过 `sources.clientManifest` 和当前版本解析。原始资料文件包含这些信息，网页包省略重复的原始物品字段以控制体积。统计与缺失情况见 [item-audit.json](../reports/item-audit.json)。

## 计算参考

- [AzerothCore item_template 字段说明](https://www.azerothcore.org/wiki/item_template)：物品字段、效果触发方式、次数及冷却。
- [5.4.8 ObjectMgr.cpp](https://github.com/alexkulya/pandaria_5.4.8/blob/e0a20613d73e2b9324ac13a4783c724fec1d4559/src/server/game/Globals/ObjectMgr.cpp)：FillItemDamageFields、FillItemArmor。
- [7.3.5 ItemTemplate.cpp](https://github.com/TrinityCore/TrinityCore/blob/7f2b7dc9c2165d2608742473a931f55b1c1a753a/src/server/game/Entities/Item/ItemTemplate.cpp)、[Item.cpp](https://github.com/TrinityCore/TrinityCore/blob/7f2b7dc9c2165d2608742473a931f55b1c1a753a/src/server/game/Entities/Item/Item.cpp)、[ItemEnchantmentMgr.cpp](https://github.com/TrinityCore/TrinityCore/blob/7f2b7dc9c2165d2608742473a931f55b1c1a753a/src/server/game/Entities/Item/ItemEnchantmentMgr.cpp)：军团基础护甲 / 伤害和属性分配。
- [7.3.5 SpellInfo.cpp](https://github.com/TrinityCore/TrinityCore/blob/7f2b7dc9c2165d2608742473a931f55b1c1a753a/src/server/game/Spells/SpellInfo.cpp)：效果基础值、骰子区间和缩放边界。
- [5.4.8 DBCStructure.h](https://github.com/alexkulya/pandaria_5.4.8/blob/e0a20613d73e2b9324ac13a4783c724fec1d4559/src/server/game/DataStores/DBCStructure.h)、[WoWDBDefs](https://github.com/wowdev/WoWDBDefs/tree/b9a63096cdd99b26967f17f9515377ae62cadfd7/definitions)：原始客户端列布局。

## 重建

完整重建：`node scripts/rebuild.mjs`。已准备主库输入后，可单独运行 `node scripts/import-items.mjs`，再执行 `npm run build`、`npm test`、`npm run validate`。物品输入缓存在 `.cache/items/`，不会发布进网页。重建会核对来源哈希；已锁定图标若在远端变化会报错，不静默替换。日常网页构建和校验不需要联网。
