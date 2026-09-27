# fedddev brand guide

Read this before changing any UI, styling, logo usage, copy tone, or 3D scene colors.
Tokens live in `tokens.css`; artwork lives in `assets/`. Use tokens by name — never hard-code a
hex value that already exists as a token. Never redraw, retype, or recolor the logo or wordmark:
use the files.

## 1. Brand in one line

**fedddev** — real-time 3D and data visualization for the web. The three d's are the 3D.
Feel: **tropical, trippy, tasteful.** Tropical = one cool color with two warm "fruit" colors,
like fruit in a tree. Trippy = layered, offset shapes and moiré ring patterns. Tasteful = flat
color, generous space, restraint. When in doubt, choose the calmer option.

## 2. Two modes

Every surface is either **dark mode** or **light mode**. Each mode has its own ground, base
color, and a **cool + two warm** accent trio. Do not mix a mode's accents into the other mode.

| Role | Dark mode | Light mode |
|---|---|---|
| Ground (page background) | Night Jungle `#0F2A24` | Frangipani `#F6EBD9` |
| Base (text, "fe"/"ev") | Frangipani `#F6EBD9` | Night Jungle `#0F2A24` |
| Cool accent | Fern `#A9D8A0` | Lagoon `#2BA39B` |
| Warm accent 1 | Mango `#F4B942` | Papaya `#F2784B` |
| Warm accent 2 | Papaya `#F2784B` | Hibiscus `#E0457B` |

**Contrast differs by mode.** In dark mode every color above meets WCAG AA 4.5:1 against the
ground, so any of them may be used for text. In light mode only the base (jungle) passes; the
light-mode accents (2.35–3.35:1 on frangipani) are for **artwork, shapes, fills, borders, icons and
underlines — never for text or as the only signal of meaning**. Light-mode text, links and labels
use jungle or muted-on-light.

## 3. Logo, wordmark, icon

### Logo (FE · DDD · EV)
Outlined artwork drawn from **Michroma**, all capitals. Three capital D's stack on a diagonal,
stepping up and to the right. **FE** sits top-left, tucked *behind* the stack; **EV** sits
bottom-right, *in front of* it. The F's lower arm is shortened and a small, heavier E sits in the
F's gap; EV's small E rests on the line of the front D's window.

Colors by mode (back D → middle D → front D):
- Dark: Fern → Mango → Papaya. FE = Fern (matches back D). EV = Papaya (matches front D).
- Light: Lagoon → Papaya → Hibiscus. FE = Lagoon. EV = Hibiscus.

### Wordmark (fe · ddd · ev)
The name in lowercase Michroma, outlined. "fe" and "ev" in the mode's base color; the three d's
in the mode's accent trio, left to right cool → warm 1 → warm 2 (same order as the logo's
back → middle → front D).
- Dark: `fe` cream · `d` fern · `d` mango · `d` papaya · `ev` cream.
- Light: `fe` jungle · `d` lagoon · `d` papaya · `d` hibiscus · `ev` jungle.

### Icon
The D stack alone on a rounded-square tile in the mode's ground color (~22% corner radius).

### Files (`assets/`)

| File | Use |
|---|---|
| `fedddev-logo-dark.svg` / `fedddev-logo-light.svg` | Full logo, transparent background, for dark / light grounds. |
| `fedddev-wordmark-dark.svg` / `fedddev-wordmark-light.svg` | Horizontal wordmark, transparent, for dark / light grounds. |
| `fedddev-icon-dark.svg` / `fedddev-icon-light.svg` | App icon / avatar tiles. |
| `favicon.svg` | Favicon; switches between dark and light icon with the OS color scheme. |
| `png/icon-512.png`, `png/icon-192.png`, `png/apple-touch-icon.png` | Manifest and iOS icons (dark). |
| `png/icon-light-512.png` | Light icon, for light-mode store listings or docs. |
| `png/favicon-32.png`, `png/favicon-16.png` | Legacy favicon fallbacks (dark). |
| `png/logo-*-1200.png`, `png/wordmark-*-1200.png` | Raster artwork for email, docs, social. |
| `png/og-image-1200x630.png` | Open Graph / social share card (dark). |

### Which mark to use
- **Logo:** hero moments, splash screens, about pages, cards. Minimum **120px tall**.
- **Wordmark:** navigation bars, headers, footers, inline lockups. Minimum **16px tall**.
- **Icon:** favicons, app icons, avatars, anywhere square or under 120px tall.
- Use the `-dark` file on dark-mode grounds and the `-light` file on light-mode grounds. In apps
  with a theme switch, swap them with the theme (see §9).

### Rules
- Clear space: at least the height of the logo's small E (or the wordmark's x-height) on every side.
- Never recolor, stretch, rotate, skew, outline, shadow, or rearrange the artwork, and never set it
  as live text. In plain text (titles, alt text, meta, package names) write `fedddev`, lowercase.
- Never place artwork on accent-colored fills, photos, or busy patterns (including the moiré).
- Alt text: `fedddev`.

## 4. Color

### Palette tokens

| Token | Hex | Notes |
|---|---|---|
| `--fd-jungle` | `#0F2A24` | Dark ground; light-mode base. |
| `--fd-jungle-surface` | `#173D34` | Raised surfaces (cards, panels) in dark mode. |
| `--fd-frangipani` | `#F6EBD9` | Light ground; dark-mode base. |
| `--fd-fern` | `#A9D8A0` | Dark-mode cool accent. |
| `--fd-mango` | `#F4B942` | Dark-mode warm accent 1. Never on light grounds. |
| `--fd-papaya` | `#F2784B` | Dark-mode warm accent 2; light-mode warm accent 1; button fill in both modes. |
| `--fd-lagoon` | `#2BA39B` | Light-mode cool accent; moiré pattern. |
| `--fd-hibiscus` | `#E0457B` | Light-mode warm accent 2; moiré pattern. |
| `--fd-muted-on-dark` | `#C9BFAE` | Secondary text, dark mode. |
| `--fd-muted-on-light` | `#4A5A55` | Secondary text, light mode. |

Use the semantic tokens (`--fd-bg`, `--fd-text`, `--fd-accent-cool`, `--fd-accent-warm-1`,
`--fd-accent-warm-2`, …) in components; they switch with the mode automatically.

### Rules
- Each mode's accents are **cool + two warm**. Keep all three together as a family; don't drop the
  cool one.
- **No yellow on light grounds.** Mango is dark-mode only.
- Dark mode: accents may be used for links, labels and display text. Light mode: accents are
  never text; links are jungle with an accent underline (3px, lagoon), and emphasis in headlines
  uses jungle weight or an accent-colored shape, not accent-colored letters.
- Body copy uses base or muted in both modes.
- No gradient washes. Colors are flat. Depth comes from offset layers, not gradients.
- Buttons, both modes: papaya fill with jungle text (5.49:1).

### Measured contrast (WCAG)

| Foreground on background | Ratio | Verdict |
|---|---|---|
| frangipani on jungle | 12.93 | any text |
| fern on jungle | 9.45 | any text |
| mango on jungle | 8.62 | any text |
| papaya on jungle | 5.49 | any text |
| muted-on-dark on jungle | 8.39 | any text |
| papaya on jungle-surface | 4.31 | large text only on raised surfaces |
| jungle on frangipani | 12.93 | any text |
| muted-on-light on frangipani | 6.17 | any text |
| hibiscus on frangipani | 3.35 | not text; shapes/artwork only |
| lagoon on frangipani | 2.61 | not text; shapes/artwork only |
| papaya on frangipani | 2.35 | not text; shapes/artwork only |
| hibiscus / lagoon / papaya on white | 3.96 / 3.08 / 2.78 | not text |
| jungle on papaya (button, both modes) | 5.49 | any text |
| jungle on lagoon | 4.95 | any text |

Logos and wordmarks are exempt from WCAG contrast requirements, which is why the light-mode
artwork can use these accents.

## 5. Typography

| Token | Font | Use |
|---|---|---|
| `--fd-font-display` | Bricolage Grotesque, 700–800 | Headlines and display text. Tight tracking (-0.03em). |
| `--fd-font-body` | Figtree, 400/500/600 | Body copy, UI, buttons. |
| `--fd-font-mono` | JetBrains Mono, 400/500 | Code, labels, eyebrows, tech tags. Uppercase + 0.12em tracking for eyebrows. |
| `--fd-font-brand` | Michroma | Source font of the logo and wordmark (which are outlined artwork). May be used sparingly for short all-caps labels (≤3 words). |

Type scale (px): 13 · 15 · 17 · 20 · 24 · 32 · 48 · 64 · 88. Body 17–20px, line-height 1.5–1.55.
Display line-height 0.95–1.05. Never use Inter, Roboto or Arial.

## 6. Pattern: moiré rings

Two sets of concentric circles as SVG strokes: set A lagoon, set B hibiscus, center offset about
+70px x / −40px y. Stroke 1–1.5px, ring spacing 30–40px, group opacity 0.4–0.6 in dark mode,
0.25–0.35 in light mode. Bleed it off an edge; never behind body text or the artwork. If animated,
drift one center slowly (≥20s) and disable under `prefers-reduced-motion`.

## 7. Layout and shape

- 8px spacing grid: 8 · 16 · 24 · 32 · 48 · 64 · 96.
- Radii: 12px small, 18–20px cards, full pill for buttons, ~22% for app icons.
- Generous whitespace; one idea per section. Max text width ~620px.
- Touch targets ≥44px. Use real `<button>` and `<a>` elements.

## 8. 3D scenes (Three.js)

- Clear color / scene background = the mode's ground: `0x0F2A24` dark, `0xF6EBD9` light.
- Accent materials = the mode's trio. Dark: fern `0xA9D8A0`, mango `0xF4B942`, papaya `0xF2784B`.
  Light: lagoon `0x2BA39B`, papaya `0xF2784B`, hibiscus `0xE0457B`.
- Neutral geometry: the mode's base color; dark raised geometry `0x173D34`.
- Fog = ground color. Favor flat or softly lit materials over glossy PBR.
- Echo the logo sparingly: stacked, diagonally offset duplicates of a hero object in the trio,
  cool (back) → warm 1 → warm 2 (front).
- Respect `prefers-reduced-motion`.

## 8a. 3D digital twins and data-dense scenes

The environment recedes; the equipment is the fruit. Structure takes the mode's cool color,
equipment takes base and warm colors, and any color that encodes data keeps its encoding.

| Role | Dark mode | Light mode |
|---|---|---|
| Background + fog | `#0F2A24` | `#F6EBD9` |
| Floor base | `#173D34` | `#FFFFFF` |
| Primary floor lines | `#A9D8A0` | `#0F2A24` |
| Secondary floor lines (pre-blended, opaque) | `#598365` | `#95D1CD` |
| Neutral equipment (e.g. cabinets) | `#F6EBD9` | `#173D34` |
| Dominant equipment (e.g. containment) | `#F2784B` | `#F2784B` |
| Edge lines on equipment | `#0F2A24` at 50% | `#0F2A24` at 50% |
| Title bar bottom border | `#264437` | `#D3CEBE` |

- Never use fern (or any light color) as a large floor or ground plane in dark mode; it outshines
  the equipment.
- Colors that encode data (status, feeds, categories) keep their encoding in both modes; give
  those objects jungle edge lines so they separate from neighbors by outline, not hue alone.
- Floor-plan images: recolor to the exact opaque hexes above (at build time or in a shader) rather
  than relying on image opacity.
- Selection: outline (fern in dark, jungle in light) and dim the rest of the scene; do not reuse a
  data-encoding color. Alarms: outline + icon, never color alone.

## 9. Implementing in an app

1. Copy `tokens.css` into global styles and import it once at the app root. It defaults to dark
   mode, follows `prefers-color-scheme`, and honors an explicit `data-theme="dark|light"` on `<html>`.
2. Copy `assets/` to the static/public folder (e.g. `public/brand/`).
3. Head tags:
   ```html
   <link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
   <link rel="icon" href="/brand/png/favicon-32.png" sizes="32x32" type="image/png">
   <link rel="apple-touch-icon" href="/brand/png/apple-touch-icon.png">
   <meta name="theme-color" content="#0F2A24" media="(prefers-color-scheme: dark)">
   <meta name="theme-color" content="#F6EBD9" media="(prefers-color-scheme: light)">
   <meta property="og:image" content="/brand/png/og-image-1200x630.png">
   ```
4. Manifest icons: `png/icon-192.png`, `png/icon-512.png`; `background_color`/`theme_color` `#0F2A24`.
5. Swap artwork with the theme, e.g.
   ```html
   <picture>
     <source srcset="/brand/fedddev-wordmark-light.svg" media="(prefers-color-scheme: light)">
     <img src="/brand/fedddev-wordmark-dark.svg" alt="fedddev" height="24">
   </picture>
   ```
   With a manual theme switch, render the `-dark` or `-light` file from the active theme instead.
6. When a project has its own product name, fedddev is the maker's mark (footer, about, splash)
   unless told otherwise.

## 10. Voice

Plain, confident, specific. Short sentences. Talk about what gets built and how fast it runs, not
adjectives. No hype words, no emoji in UI. Example headline: "Interfaces with depth."

## 11. Open decisions

- Headline font: Bricolage Grotesque (current) vs. adopting Michroma more widely.
