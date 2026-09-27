# 3db

**A database you can walk through.** Every row becomes an object in a 3D world.
Grouping builds districts, sorting builds skylines, filtering sinks what doesn't
match, and time stretches into distance. Drive it with your voice or a command bar.

You start on an empty floor. Drop a CSV onto the page (or use Upload CSV) and it
builds in front of you, already colored by one of its columns. Once it loads, a
key shows facts about the file and whatever is applied (color, height, groups,
sort, filters); "show keys" adds its columns and what you can say. "clear all"
undoes what you've added.

```bash
npm install
npm run dev
```

Click the world to look around · WASD or arrows to walk and strafe · Space/C up/down (never below eye height) · Shift to run · "recenter" to go back to the start ·
V to talk · / to type · try "group by <column>", "color by <column>", "only <column> above 10", "help".

Voice uses the browser's Web Speech API (Chrome, Edge, Safari). Everything runs
in the browser; SQL runs on [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview).
