# 数据来源与权利声明

本仓库的原创网页与导入工具采用根目录 MIT 许可证。该许可证**不适用于魔兽世界任务原文或第三方数据库资料**。

`data/` 中的任务资料以及 `web/data/` 中的等价离线副本由公开社区数据库整理而来，必须保留对应上游署名、许可证及版权说明。具体来源、固定提交、下载文件 SHA-256 与转换方法见 `sources/manifest.json` 和 `docs/DATA.md`；上游许可原件位于 `sources/licenses/`。

| 资料来源 | 上游项目许可证 / 声明 |
| --- | --- |
| CMaNGOS Classic-DB | GPL-3.0；另有 COPYRIGHT.md 明确说明 Blizzard 内容不在 GPL 授权之内 |
| AzerothCore | 上游 LICENSE 原件（GPL-2.0） |
| MaNGOS Three (4.3.4) | 数据库 CC BY-NC-SA 3.0；Translations 子目录另附 GPL-2.0。保留两份原始声明及非商业限制 |
| alexkulya/pandaria_5.4.8 | GPL-2.0；社区 5.4.8 适配数据，含后续采集的本地化文字 |
| TrinityCore TDB735.00 | GPL-2.0 项目声明及 COPYING 原件 |
| MaNGOS Zero（经典旧世补充） | 数据库 CC BY-NC-SA 3.0；Translations 子目录另附 GPL-2.0，保留两份声明 |
| CMaNGOS WotLK-DB（巫妖王之怒补充） | GPL-3.0；另有 Blizzard COPYRIGHT.md 声明 |
| FirelandsProject/firelands-cata（大地的裂变补充） | GPL-2.0，保留 LICENSE 与 AUTHORS |
| ProjectSkyfire/SkyFire_548（潘达利亚补充） | GPL-3.0，保留 LICENSE.md 与 README.md |
| dufernst/LegionCore-7.3.5（军团补充） | 项目标示 GPL-2.0；README 明示核心源自 UWOW 2020 泄露版本。保留该来源说明，不把公开仓库或许可证标示视作游戏文本的独立权利证明 |
| mangosfour/database（潘达利亚中文补充） | GPL-3.0，保留 LICENSE 和 README.md |
| The-Legion-Preservation-Project/TrinityCore（军团中文补充） | GPL-2.0，保留 COPYING 和 README.md；TDB735.25051 社区快照 |
| zitengzela/LegionCore-7.3.5V2（军团中文补充） | GPL-2.0，保留 COPYING 和 README.md；Legion Proyect 数据库，具有 LegionCore/UWOW 派生背景，未独立核实全部文字来源 |
| Wago Tools 的 7.3.5.26972 客户端 DB2 导出（阅读称呼表） | `sources/reading/` 保存原始简中、繁中、英文 CSV 及来源哈希；属于 Blizzard 游戏数据，不纳入本项目 MIT 授权 |
| Wago Tools 的 7.3.5.26972 奖励辅助表 | 物品、阵营、货币、法术、经验及奖励包等客户端数据，原始 URL 和哈希见 `sources/rewards/manifest.json`；属于 Blizzard 游戏数据 |
| Kaev/AzerothcoreDBCToSQL（3.3.5 奖励辅助表） | 固定提交的客户端 DBC 转 SQL 数据，未附单独许可证；不属于本项目 MIT 授权 |
| caicaicai/dbc434（4.3.4 奖励辅助表） | 保留仓库 GPL-3.0 LICENSE；客户端数据权利仍属于 Blizzard 或相应权利人 |

World of Warcraft 及相关任务文本、角色、世界设定、商标与游戏内容归 Blizzard Entertainment 或相应权利人所有。本项目为独立研究与资料整理项目，与 Blizzard Entertainment 无隶属或授权关系。

奖励物品扩展档案 `data/items/`、网页副本 `web/items/` 和 `web/icons/` 同样不适用本项目 MIT 授权。额外来源包括 Xian55/tortoise-db-viewer 的客户端提取 JSON、wowgaming/client-data v20.0、5.4.8 项目链接的客户端 Data.zip、4.3.4 / 7.3.5 客户端表、wowdev/wow-listfile 文件名映射，以及 Wowhead/ZAM 提供的 Blizzard 物品图标。具体来源与文件哈希见 `sources/items/`，转换边界见 `docs/ITEMS.md`。公开下载或社区程序的开源许可不代表游戏文字、数值或图像被重新授予 MIT 许可；转发离线包时须保留本声明与这些来源清单。

上游程序或数据库结构的开源许可，不表示游戏原文已被重新授权为 MIT，也不构成模型训练或其他使用目的的单独授权。研究导出保持来源与版本信息。需要转发资料时，应一并保留本声明和上游许可文件。
