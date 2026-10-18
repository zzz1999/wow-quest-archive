# 给 AI 的研究入口

先阅读 `docs/DATA.md`、`sources/manifest.json` 和 `reports/coverage.json`，再按需读取 `data/<version>/*.jsonl`。不要一次把整个资料库放入上下文；按任务 ID、关键词、任务关系或研究问题检索。

推荐把本项目用于引用有出处的检索与分析。它提供数据格式和导出便利，不保证包含某个资料片的全部任务，也不单独授予游戏原文的训练许可。

网页默认玩家视角，会按阅读设置代入名字、职业、种族及性别称呼，还会使用目标需求数量和军团客户端职业称呼表。引用原始语料请使用 JSON / JSONL 或“原文视角”；“复制当前文本”可能已经代入个人角色资料和展示解释，不应直接当作原始数据库引文。映射的来源与证据层级见 [阅读变量说明](READING-VARIABLES.md)。

## 分析顺序

1. 确认版本、源任务 ID、实际采用语言和字段是否缺失；逐字段查看 `textSources`，通过该版本的 `supplements` 找到确切仓库与固定提交。`source` 只标识主库，不能代替补充文字的来源。
2. 观察委托人与玩家的关系、动机、冲突、行动目标、反馈和下一步引导。
3. 沿 `links` 查相邻任务，再检查支线、条件与互斥关系，避免把孤立任务当完整故事。
   沿 `starters` / `enders` 的 `key` 查 `data/<version>/actors/*.jsonl`，查看 NPC 名称、称号和它的 `starts` / `ends` 关联任务；只在同版本内解析任务 ID。
4. 区分原文证据与分析结论；对缺失对白只记录缺失。
5. 跨版本比较使用 `version:id`，明确文本来自哪个社区快照；尤其注意潘达利亚较晚采集的中文。

研究原版风格时默认排除 `community-custom`、`suspected-test`，但启发式标记不能代替人工检查。中文叙事样本应检查 `textLocales.description`、`textLocales.progress` 与 `textLocales.completion`，不能只按标题语言筛选。

研究一次性叙事与重复委托时，可以使用网页重复类型筛选与 `reports/quest-traits.json`。规则按版本解释 `flags` / `specialFlags`，军团世界任务另核对客户端类型；“重复性待确认”不能当作非可重复。阵营标签由 `raceMask` 与当前版本种族推导，不证明任务真实可接。原始导出保留位掩码，解释和边界见 [重复规则与接取条件](QUEST-TRAITS.md)。

多源文字使用同版本英文标题、对应字段或上下文进行保守匹配，依据记录在 `textMatches` 和 `reports/text-audit/`。这不证明每句译文准确，也不意味着几个社区库是独立采集；不要把同源文字重复算作多份证据。补充库不会改动任务关系、奖励、等级或 NPC 关联。

奖励另行从主库与同版本客户端表规范化到 `rewards`，原始字段仍在 `sourceFields`。`choices` 与奖励包中的候选不能全部相加；`null` 不代表无奖励。经验、声望与金钱的 `basis` 记录换算依据，名称使用自己的 `nameSource`。不要把基础值当作玩家最终结算；方法与缺失统计见 [奖励说明](REWARDS.md)。

物品属性另存于 `data/items/<version>/*.jsonl`，使用 `version:item:id` 关联。`raw` 是来源字段，`effects.rawDescription` 是原始效果说明，网页解释和解析后的 `effects.text` 不能当作逐字游戏引文。随机属性、角色缩放和缺失说明不能由其他版本同 ID 补齐，详见 [物品说明](ITEMS.md)。

军团新补充的中文对白大量标记 `textBuilds` 为 0，表示未核实采集版本，不能当作官方逐字文本的证明。主库没有对应英文时，英文对照可能随选中的中文补充来源变化，检查 `englishSources`。网页特殊变量标签是阅读说明，不能据此推断未知 NPC 身份、玩家军衔或实时数值。

NPC 档案只覆盖任务接取 / 交付涉及的对象，不能当作完整人物图鉴。名称与称号独立回退，分别检查 `nameLocale` 与 `subnameLocale`。缺少模板或称号时保留未知；不要从名称推导称号、身份背景、坐标或可接任务条件。分析 NPC 关联任务时同样检查每条任务的测试 / 自定义标签。

可记录原创分析标签：

- 委托动机：求助、职责、交易、好奇、情感关系等。
- 信息组织：角色口吻、背景交代、行动要求、风险提示、留白。
- 行动与叙事关系：行动是否推动冲突、改变人物关系、揭示新信息。
- 完成反馈：承认玩家贡献、反转、代价、幽默、后续钩子。

这些标签应另存于 `annotations/` 等独立目录，并注明分析者/模型与时间；不要写回原始文本字段，也不要把模型解释当作原始任务内容。

## 读取示例

```python
import json
from pathlib import Path

for file in Path('data/wotlk').glob('*.jsonl'):
    for line in file.open(encoding='utf-8'):
        quest = json.loads(line)
        if quest['id'] in (5846, 5848):
            print(quest['key'], quest['text']['title'])
            print(quest['text']['description'])
            print(quest['textLocales'], quest['links'])
```

可用研究提示词：

> 读取 wotlk:5846 与 wotlk:5848，并检查它们的前后置关系。分别提取委托动机、具体行动、信息揭示与完成反馈。每项结论附任务 key 和字段名，区分原文事实与分析。只总结可迁移的写作方法，不将游戏专名、设定或原对白直接改写为新作品。
