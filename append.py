with open('c:/Users/svija/.gemini/antigravity/scratch/Dota 2 Coach Immortal+/project_specs.md', 'a', encoding='utf-8') as f:
    f.write("""
### Recent Progress (September 25)
- **Data Sync Pipeline**: Modified `backend/services/sync.py` to stop explicitly filtering keys. The database now stores the entire unadulterated OpenDota `players` array blob (including nested logs, connection events, damage target granularity) to ensure all tabs have complete 1-to-1 parity data.
- **Actions Tab**: Restored the Actions tab component after repairing the `actions` data block in the `sync.py` pipeline.
- **Teamfights Tab**: Fully implemented a 1-to-1 clone of OpenDota's Teamfights visualizer.
  - Interactive scrubbable timeline rendering gold and xp deltas.
  - Map overlay projecting `deaths_pos` directly onto the 7.41 terrain (`m.x / 127` map normalization).
  - Built custom `IconRadiant` and `IconDire` SVGs to replace broken steam CDN pngs.
  - Tooltips precisely matching OpenDota's "Killed By" rendering with dark `rgba(30,30,30,0.95)` backgrounds.
  - Removed deprecated `odota_ui_temp` references, making `MatchTabs.tsx` fully independent.
""")
