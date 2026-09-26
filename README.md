# 3db

**A database you can walk through.** Every row becomes an object in a 3D world.
Grouping builds districts, sorting builds skylines, filtering sinks what doesn't
match, and time stretches into distance. Drive it with your voice or a command bar.

Built-in worlds:

- **3db build history.** Every commit to this project and its 2018 ancestor. It grows with every push.
- **Earthquakes, past 7 days.** Live from USGS, each quake hanging at its true depth below the floor.
- **Everything you said to 3db.** Your own command log, as data.

Or drop any CSV onto the page.

```bash
npm install
npm run dev
```

Click the world to look around · WASD to move · Space/C up/down · Shift to run ·
V to talk · / to type · try "group by region", "color by depth", "only mag above 4.5", "help".

Voice uses the browser's Web Speech API (Chrome, Edge, Safari). Everything runs
in the browser; SQL runs on [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview).
