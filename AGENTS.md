# Working with the quest archive

- Read README.md, docs/DATA.md, docs/AI-RESEARCH.md and sources/manifest.json first.
- Quest identity is version + ID. Never merge equal IDs across versions.
- Actor identity is version + kind + ID. Keep NPC and gameobject archives separate, preserve independent name/title language provenance, and validate both directions of quest relations.
- Preserve raw quest text and game placeholders. Do not invent missing text or silently translate it.
- Retain field-level locale, table/column, capture-build and source provenance.
- Community database snapshots are not proof of official completeness or runtime behavior.
- Keep research annotations separate from the source-derived corpus.
- Keep the site fully offline: no CDN, telemetry, remote assets, required server or runtime package installation.
- Update normalized JSONL through the reproducible importer, rebuild browser bundles and run npm test plus npm run validate before committing changes.
- Website/tool MIT licensing does not cover upstream data or Blizzard game text; preserve sources/licenses and DATA-LICENSE.md.
