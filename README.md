# 3db

**A database you can walk through.** Every row becomes an object in a 3D world.
Grouping builds districts, sorting builds skylines, filtering sinks what doesn't
match, and time stretches into distance. Drive it with your voice or a command bar.

You start on an empty floor. Drop any CSV onto the page and it builds around you.

```bash
npm install
npm run dev
```

Click the world to look around · WASD to move · Space/C up/down · Shift to run ·
V to talk · / to type · try "group by <column>", "color by <column>", "only <column> above 10", "help".

Voice uses the browser's Web Speech API (Chrome, Edge, Safari). Everything runs
in the browser; SQL runs on [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview).
