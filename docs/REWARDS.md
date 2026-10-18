# 任务奖励

任务详情的“任务奖励”列出固定物品、任选物品、奖励包候选、金钱、经验、声望、货币，以及源中记录的法术效果、头衔、技能点、天赋点与邮件信息。物品展示名称、数量、品质、基础物品等级和装备位置；可点击名称在 Wowhead 查看更多内容。网页所需资料全部打包在本地，只有点击外链才需要联网。

每条任务新增 `rewards` 对象，JSON / JSONL 导出和“复制当前文本”也包含奖励。原有 `sourceFields`、任务原文、NPC 关系保持不变。

## 来源

| 版本 | 物品名称与基础属性 | 奖励换算及辅助名称 |
| --- | --- | --- |
| 经典旧世 | CMaNGOS 同一固定提交的 `item_template` 与 Chinese `locales_item.sql` | 基库 `spell_template` 的法术名称；经验按 CMaNGOS 的经典任务换算方式计算 |
| 巫妖王之怒 | AzerothCore 同一固定提交的物品表及本地化表 | Kaev/AzerothcoreDBCToSQL 的 3.3.5 DBC 导出；固定提交与哈希见奖励清单 |
| 大地的裂变 | MaNGOS Three 同一固定提交的物品表与 Chinese / Taiwanese 本地化 | caicaicai/dbc434 的 4.3.4 英文 DBC，固定提交与哈希见奖励清单 |
| 潘达利亚之谜 | 主库 5.4.8 物品表及本地化表 | 使用任务字段中直接记录的数量及声望覆盖值；未借用其他版本的经验、声望或奖励包表 |
| 军团再临 | Wago Tools 的 7.3.5.26972 `ItemSparse`，简中 → 繁中 → 英文 | 同一 build 的 `QuestXP`、`QuestMoneyReward`、`QuestFactionReward`、`QuestPackageItem` 及阵营、货币、法术、头衔、技能表 |

主库增加的下载文件记录在 [sources/manifest.json](../sources/manifest.json)。辅助表的原始 URL、版本、字节数、SHA-256 记录在 [sources/rewards/manifest.json](../sources/rewards/manifest.json)。所有下载先校验哈希，再由导入器转换，不执行上游 SQL。

Kaev 导出的部分 Faction / Spell 描述列存在双重转义，无法作为完整 SQL 正常解析。这里仅严格读取已核对列位置的 ID 与第一个英文名称字符串；不修复、不使用那些描述，也不把英文列标为中文。该来源没有单独的许可证文件，游戏数据不属于本项目 MIT 授权。4.3.4 来源的 GPL 原件保存在 `sources/licenses/rewards-cata-LICENSE`。

## 字段与计算边界

- `items` 是固定物品；`choices` 是选取列表，不能相加当成全部获得。
- `package.items` 来自同版本的 `QuestPackageItem`。保留行 ID、`DisplayType`、数量及名称出处。职业、专精、阵营筛选没有完整模拟，因此展示候选清单，不承诺某个角色可以选择全部物品。未找到包明细时保留包 ID，页面明确说明缺失。
- 名称独立保留 `nameLocale`、`nameSource.source/table/column/build`；物品属性有 `detailsSource`。名称缺失时显示对象类型与 ID，不由 AI 补写或跨版本套用。
- `experience.amount` 是角色处于任务等级、未计衰减与额外加成时的基础参考值。经典旧世使用 `RewMoneyMaxLevel` 和任务等级换算；其余已收录的经验表按等级行、难度列查表，再按对应核心规则取整。难度索引不是经验值。任务等级为 -1 时不假设玩家等级。
- `money.copper` 以铜为单位。经典、巫妖、裂变、潘达利亚保留直接记录值；负数显示为“需要支付”。军团按同版本 `QuestMoneyReward` 和任务等级、倍率换算，`capturedCopper` 另存原始任务记录，二者不叠加。巫妖基库的 `RewardMoneyDifficulty` 按玩家等级计算，因此页面保留记录值并注明变化。
- `money.maxLevelBonus` 是源字段中的满级额外金钱，独立于常规金钱；`NO_MONEY_FROM_XP` 时不显示。不同服务端的满级经验转钱实现不完全一致，本项目不模拟完整角色结算。
- 经典 `RewRepValue` 为直接声望值。后续版本的声望难度通过本版本 `QuestFactionReward` 查表；非零覆盖值先除以 100，保留正负号。页面显示基础增减，未模拟阵营溢出、声望上限、种族与服务器倍率。
- 法术区区分展示奖励与完成时触发的效果，不能据此认定每个法术都会被永久学会。头衔中的 `%s` 仅在阅读时代入玩家称呼，导出原始值不变。
- 货币数量、技能点和固定荣誉采用源记录。荣誉倍率、动态奖励 ID、神器能量和邮件附件没有展开成未经验证的最终奖励。
- 物品等级是模板基础等级，不模拟随机词缀、升级、缩放曲线或最终装备属性。图标悬浮提示框展示可核实的伤害、护甲、属性和效果；具体来源及缺失边界见 [离线物品说明](ITEMS.md)。掉落概率未收录。

原始列的位置保存在 `rewards.columns`；换算值在 `basis` 保留表、行、列或换算方法。`null` 表示未解析 / 未收录，不能当作 0。统计与缺失对象见 [reports/reward-audit.json](../reports/reward-audit.json)。

## 解释依据

- [CMaNGOS Classic QuestDef.cpp](https://github.com/cmangos/mangos-classic/blob/e42ef12ef77152d30631a50f79f720cee113db6c/src/game/Quests/QuestDef.cpp)：经典经验换算与满级金钱标志。
- [AzerothCore QuestDef.cpp](https://github.com/azerothcore/azerothcore-wotlk/blob/8265956f54c64ad082e2b9f8d37db64b38600b3f/src/server/game/Quests/QuestDef.cpp)：经验取整、玩家等级相关的金钱和荣誉。
- [TrinityCore 7.3.5 QuestDef.cpp](https://github.com/TrinityCore/TrinityCore/blob/7f2b7dc9c2165d2608742473a931f55b1c1a753a/src/server/game/Quests/QuestDef.cpp)、[Player.cpp](https://github.com/TrinityCore/TrinityCore/blob/7f2b7dc9c2165d2608742473a931f55b1c1a753a/src/server/game/Entities/Player/Player.cpp)：军团经验、金钱和奖励包候选筛选。
- [TrinityCore 字段说明](https://trinitycore.info/database/335/world/quest_template)：声望覆盖值、奖励数量等字段含义；实际字段布局以锁定版本源码与数据为准。
- [WoWDBDefs 固定版本](https://github.com/wowdev/WoWDBDefs/tree/b9a63096cdd99b26967f17f9515377ae62cadfd7/definitions)：4.3.4 WDBC 表结构。解析器检查魔数、字段数量、记录长度和字符串偏移。

这些是社区数据库与客户端表的资料展示和源码核对，不代表已在每个私服或官方客户端中逐项验证奖励结算。

## 复现

运行 `node scripts/rebuild.mjs` 时会自动读取奖励辅助表，缓存位于 `.cache/rewards/<version>/`。无需安装数据库。仅更新网页样式可运行 `npm run build`；完成后运行 `npm test`、`npm run validate`。
