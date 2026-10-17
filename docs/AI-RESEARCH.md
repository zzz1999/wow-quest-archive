# 给 AI 的研究入口

先阅读 `docs/DATA.md`、`sources/manifest.json` 和 `reports/coverage.json`，再按需读取 `data/<version>/*.jsonl`。不要一次把整个资料库放入上下文；按任务 ID、关键词、任务关系或研究问题检索。

推荐把本项目用于引用有出处的检索与分析。它提供数据格式和导出便利，不保证包含某个资料片的全部任务，也不单独授予游戏原文的训练许可。

## 分析顺序

1. 确认版本、源任务 ID、实际采用语言和字段是否缺失。
2. 观察委托人与玩家的关系、动机、冲突、行动目标、反馈和下一步引导。
3. 沿 `links` 查相邻任务，再检查支线、条件与互斥关系，避免把孤立任务当完整故事。
4. 区分原文证据与分析结论；对缺失对白只记录缺失。
5. 跨版本比较使用 `version:id`，明确文本来自哪个社区快照；尤其注意潘达利亚较晚采集的中文。

研究原版风格时默认排除 `community-custom`、`suspected-test`，但启发式标记不能代替人工检查。中文叙事样本应检查 `textLocales.description`、`textLocales.progress` 与 `textLocales.completion`，不能只按标题语言筛选。

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
