---
name: MIDI Vault
description: Print shop for MIDI — a producer's pack library as a crate of screen-printed show posters.
colors:
  coral: "#e85a3c"
  coral-deep: "#c74a2e"
  chartreuse: "#c6c937"
  chartreuse-deep: "#9da32c"
  stamp-red: "#d0452f"
  ink-olive: "#64691a"
  plum-paper: "#2a2338"
  cream-stock: "#f0e6cd"
  cream-aged: "#e7dbbd"
  paper-bright: "#fff9ea"
  ink-black: "#241f2e"
  ink-soft: "#4a4258"
  cream-dim: "#b6aacb"
  rule: "rgba(240, 230, 205, 0.16)"
typography:
  display:
    fontFamily: "'Big Shoulders', 'Arial Narrow', 'Segoe UI', sans-serif"
    fontSize: "34px"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "0.01em"
  headline:
    fontFamily: "'Big Shoulders', 'Arial Narrow', 'Segoe UI', sans-serif"
    fontSize: "25px"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0.015em"
  title:
    fontFamily: "'Big Shoulders', 'Arial Narrow', 'Segoe UI', sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.02em"
  body:
    fontFamily: "'Libre Franklin', 'Segoe UI', system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Libre Franklin', 'Segoe UI', system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.16em"
rounded:
  sm: "2px"
  md: "3px"
  lg: "4px"
  round: "50%"
spacing:
  xs: "5px"
  sm: "9px"
  md: "14px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.cream-stock}"
    rounded: "{rounded.md}"
    padding: "7px 13px"
  button-primary-hover:
    backgroundColor: "{colors.coral-deep}"
    textColor: "{colors.cream-stock}"
  button-outline:
    textColor: "{colors.cream-stock}"
    rounded: "{rounded.md}"
    padding: "7px 13px"
  button-ghost:
    textColor: "{colors.cream-dim}"
    rounded: "{rounded.md}"
    padding: "7px 13px"
  input-ticket:
    backgroundColor: "{colors.cream-stock}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  tag:
    backgroundColor: "{colors.cream-aged}"
    textColor: "{colors.ink-black}"
    padding: "6px 9px 6px 16px"
  tag-active:
    backgroundColor: "{colors.chartreuse}"
    textColor: "{colors.ink-black}"
  badge-stamp:
    textColor: "{colors.ink-black}"
    rounded: "{rounded.sm}"
    padding: "2.5px 7px"
  card-poster:
    backgroundColor: "{colors.cream-stock}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.md}"
    padding: "14px 14px 12px"
  nav-item:
    textColor: "{colors.cream-dim}"
    padding: "7px 2px"
  nav-item-active:
    textColor: "{colors.coral}"
---

# Design System: MIDI Vault

## Overview

**Creative North Star: "The Screen-Print Poster Shop"**

A producer's library is a crate of screen-printed show posters, not a database. The whole surface is built from exactly two papers — a deep plum poster wall and cream card stock — and everything on them is hand-pulled ink: coral, chartreuse, black, a red rubber stamp. Type is wood type (Big Shoulders, heavy, uppercase, tight) over a Libre Franklin workhorse. Things sit slightly crooked, throw real paper shadows, and arrive by being stamped or pulled off the press. The retired dark-dashboard-plus-neon look is the confirmed anti-reference (PRODUCT.md, 2026-07).

This is an Operate-mode surface: dense (13.5px base), fast with a 1,000-card grid (lazy canvas thumbnails), and the jobs — dig, grab, cook — are never obscured by the expression. Drag affordances are load-bearing: card headers and billing lines are real OS drag sources.

**The world's vocabulary** (used in UI copy; keep extending it, never mix in SaaS-speak):

- **Press Room** — the generator view; its header is "Set the plates".
- **Pull a print / pull** — generate a pack; "Pull with a fresh seed".
- **Ink knobs** — the generator's rotary controls.
- **Billing lines** — the four draggable part rows (Chords / Melody / CounterMelody / Bass) on a poster card.
- **Pulls / Fresh prints** — sidebar smart views; **Reprint** — regenerate a single part.
- **Shop Note** — every toast is stamped with this kicker.
- **The paste-up wall** — Song Drop; "Paste a song on the wall", "the shop listens", "Print a matching pack".

**Key Characteristics:**
- Two papers, hand-pulled ink; zero gradient washes, zero glow, zero glass.
- Wood-type display: heavy, uppercase, line-height under 1.
- Everything paper is slightly rotated and shadowed; interaction squares it up.
- Motion = ink stamps and press pulls (exponential ease-out, transform + opacity only).
- All assets local (CSP `img-src 'self' data:`; fonts bundled OFL woff2). The three background rasters (`paper-plum.webp`, `paper-cream.webp`, `pasteup-wall.webp`) are AI-generated print-shop textures, licensed for use, shipped in `src/renderer/src/assets/art/`.

## Colors

Two paper neutrals carry everything; color is opaque ink printed on one of the two papers, never a wash over both.

### Primary
- **Pressed Coral** (#e85a3c): the pull. Primary buttons ("Pull a print", card Play), the circular press-wheel play button, active nav underline slab, NOW PLAYING stamp, focus outlines, progress fill, knob value arcs.
- **Coral Deep** (#c74a2e): the same ink pressed harder — hover state of every coral surface, coral title ink runs on cream, toast kicker text.

### Secondary
- **Chartreuse Pull** (#c6c937): the second screen ink. Active paper tags, solo-on state, every third knob arc, `code` highlights on the plum wall.
- **Chartreuse Deep** (#9da32c): mood badge ink and counter-melody notes in the piano-roll woodcut.

### Tertiary
- **Rubber Stamp Red** (#d0452f): the stamp pad, semantically loaded — favorite hearts and destructive menu actions only.
- **Olive Ink** (#64691a): the third title ink run on poster cards (`.ink-olive`), rotating with coral and black per card hash.

### Neutral
- **Plum Paper** (#2a2338): the poster wall — app background, overlaid with the `paper-plum.webp` raster (fixed, cover). Also the inset knob-board inside cream panels.
- **Cream Stock** (#f0e6cd): the card stock — poster cards, panels, transport, menus, toasts (all textured with `paper-cream.webp` tiled at 480–560px); also primary text color on plum.
- **Aged Cream** (#e7dbbd): older paper — sidebar tags, knob label chips.
- **Bright Paper** (#fff9ea): input fill when the input sits on cream stock (Press Room controls, tempo select).
- **Ink Black** (#241f2e): the black ink — all text and borders on cream.
- **Soft Ink** (#4a4258): secondary ink on cream — labels, hints, meta lines.
- **Dim Cream** (#b6aacb): secondary text on plum, tinted toward the paper hue — inactive nav, side headings, hints.
- **Rule** (rgba(240, 230, 205, 0.16)): hairline dividers on the plum wall (toolbar, sidebar edges).

### Named Rules
**The Two Papers Rule.** Every surface is either plum wall or cream stock. No third material, no translucent panels (the only alpha surfaces are the plum sidebar tint and the tutorial scrim, both the same plum).

**The Ink Rule.** Color is opaque ink: flat fills, `1.5px` ink borders, misregistration text-shadows. Never gradient fills, never glows, never white. (The transport's ruler ticks use `repeating-linear-gradient` strictly as a printed tick pattern — that is drawing, not a wash.)

## Typography

**Display Font:** Big Shoulders (variable 500–900, bundled woff2, OFL; fallback 'Arial Narrow', 'Segoe UI')
**Body Font:** Libre Franklin (variable 300–800 + italic 400, bundled woff2, OFL; fallback 'Segoe UI', system-ui)
**Mono:** Consolas stack, only for `code` in the Guide.

**Character:** Wood type over job print. Big Shoulders is always uppercase, always heavy (700–900), always tight (line-height 0.92–0.95, letter-spacing ≈ 0.01–0.06em). Libre Franklin does everything else and specializes in small, loud, letterspaced caps labels.

### Hierarchy
- **Display** (900, 34px, 0.92–0.95): logo, Press Room head ("Set the plates"), overlay poster headlines (30px on the tutorial and paste-up sheet).
- **Headline** (800, 25px, 0.95): poster-card titles, printed in one of the three rotating ink runs with a 1.4px misregistration text-shadow.
- **Title** (800, 20–22px): toolbar view names, section h3s, stat values, the Press Room's primary button.
- **Wood-type UI** (700, 15–21px): nav items (21px) and billing lines (15px) — navigation is set in display type, not body type.
- **Body** (400–600, 12–13.5px, 1.6): copy, hints, menu items. Hints are Dim Cream on plum, Soft Ink on cream.
- **Label** (600–800, 8.5–10px, 0.1–0.32em tracking, uppercase): control labels, side headings, drag hints, badge text, stamp kickers. The smaller the type, the wider the tracking.

### Named Rules
**The Wood Type Rule.** If it names a thing (nav, titles, part names, stat values), it's Big Shoulders, uppercase, ≥700. If it explains a thing, it's Libre Franklin. No third voice.

## Layout

A fixed press-shop floor, not a scrolling page. The app is a full-height flex column (`body` is `overflow: hidden`, no page scroll, `user-select: none` except the Guide): job-board sidebar (224px, fixed) on the left; main column with a toolbar row (view name + hint, hairline rule below), an optional filter row, and a single scrollable `.content` region (20px padding); the letterpress ruler transport pinned at the bottom, full width.

- **Poster wall grid:** `repeat(auto-fill, minmax(300px, 1fr))`, gap 22px × 18px. Stays performant at 1,000 cards: piano-roll thumbnails are lazy canvases fetched via IntersectionObserver and cached.
- **Press Room:** flex + wrap; a 500px two-column cream control panel beside a ≥340px result column. No media queries anywhere — this is a desktop Electron surface; wrap and `auto-fill` do the responsive work.
- **Rhythm:** micro 4–5px, within-component 8–10px, card padding 14px, panel/content padding 20px, between-poster gaps 18–22px.

## Elevation & Depth

Depth is stacked paper under a workshop lamp. Every raised element is a piece of cream stock throwing one warm plum-black shadow (`rgba(10, 6, 18, …)`), offset down-right as if lit from the upper left. There are no glows, no ambient halos, no inset depth, no blur-glass; the plum wall itself is always flat.

### Shadow Vocabulary
- **Paper at rest** (`box-shadow: 4px 5px 14px rgba(10, 6, 18, 0.45)` = `--shadow-paper`): poster cards, panels, dropzone, Guide cards.
- **Paper lifted** (`6px 9px 22px rgba(10, 6, 18, 0.55)`): card hover, paired with `translateY(-3px)` and un-tilting.
- **Small print** (`2px 3px 8px rgba(10, 6, 18, 0.35)`): inputs, tags, primary buttons, knob thumbs.
- **Loose slip** (`5px 7px 18px rgba(10, 6, 18, 0.5)`): menus and toasts floating above the wall.
- **Overlay poster** (`8px 12px 40px rgba(10, 6, 18, 0.7)`): the tutorial card over the scrim.
- **The transport** (`0 -4px 16px rgba(10, 6, 18, 0.45)`): the one upward shadow — the ruler is the bench everything else sits above.

### Named Rules
**The Stacked Paper Rule.** One shadow per element, warm plum-black, offset down-right. If it doesn't read as paper over paper, it doesn't get a shadow.

## Shapes

Near-square print corners: 2px on small print (inputs, badges, tags, menus, stats), 3px on cards, panels and buttons, 4px on the dropzone — nothing pill-shaped, nothing over 4px except true circles (the 46px press-wheel play button, the tutorial's 58px step medallion, knob arcs, tutorial dots).

Recurring silhouettes, all built in CSS:
- **The ticket:** inputs carry a `5px dashed` ink left border — a perforation edge. On cream panels the fill brightens to Bright Paper and the remaining border is solid ink.
- **The paper tag:** sidebar filters use `border-radius: 2px 8px 8px 2px` plus a punched hole (a 5px plum disc with an ink ring, `::before`).
- **The tape:** the tutorial poster is hung with two translucent aged-cream tape strips (`::before`/`::after`, rotated ∓4°/3°).
- **The stamp:** badges are `1.5px solid currentColor` boxes; the NOW PLAYING flag is a solid coral chip stamped over the card edge.
- **The slab:** active nav gets a 42×4px coral underline bar rotated −0.6°.

### Named Rules
**The Half-Degree Rule.** Paper never lands straight. Cards, tags, badges, stats, toasts, chips and labels sit at ±0.3°–2°, alternating direction by `nth-child` or a stable per-pack hash; hover/focus squares cards back to 0°. Text blocks on the wall (toolbar, sidebar copy, Guide) stay level.

## Components

### Buttons — letterpress labels
- **Shape:** near-square (3px), uppercase Libre Franklin 12px/700, 0.04em tracking, padding 7px 13px.
- **Default (outline):** transparent with a 1.5px cream ink border on plum; on cream surfaces the border and text switch to Ink Black and hover is a faint ink wash (`rgba(36, 31, 46, 0.07–0.08)`).
- **Primary:** Pressed Coral fill, cream text, small-print shadow; hover deepens to Coral Deep. The Press Room's "Pull a print" is the same button set in wood type (Big Shoulders 800, 20px) with a harder press.
- **Press feel:** every `:active` is `translate(1px, 1px)` — the button physically goes down (3px on the big pull).
- **Ghost:** borderless Dim Cream text until hover.
- **Focus:** all controls get a 2px coral outline, offset 2px.

### Tags (sidebar filters)
- **Style:** Aged Cream paper tags with punched hole, ink caps text, small-print shadow, alternating ±0.5° tilt.
- **State:** hover brightens to Cream Stock; active is a solid Chartreuse pull. Counts ride at 55% opacity.

### Badges — stamp badges
- **Style:** transparent, 1.5px `currentColor` border, 9.5px/700 caps at 0.1em, rotated ∓0.8°/0.7°.
- **Ink assignment:** genre stamps in Coral Deep, mood in Chartreuse Deep, everything else (BPM, key, era) in Ink Black.

### Inputs / Fields — tickets
- **Style:** cream fill, ink text, dashed perforation left edge, 2px corners; Bright Paper fill with solid ink borders when sitting on a cream panel.
- **Range sliders:** cream track at 35% alpha, 16px coral thumb ringed in cream.
- **Focus:** the shared 2px coral outline. No inline validation styling exists; errors arrive as Shop Notes.

### Navigation — the job board
- **Style:** stacked wood type (Big Shoulders 700, 21px, uppercase) on the translucent plum board; Dim Cream at rest, Cream on hover, Coral plus the rotated slab underline when active. No boxes, no pills, no icons.

### Poster Card (signature) — the pack is a mini show poster
- **Stock:** Cream Stock textured with `paper-cream.webp`, 3px corners, 14px padding, `--shadow-paper`, hash-stable tilt class (`tilt-a` −0.35° / `tilt-b` 0.3° / straight).
- **Title ink runs:** the headline prints in one of three inks (coral / black / olive) keyed by a djb2 hash of the packId, each with a 1.4px offset text-shadow in the opposing ink — double-print misregistration.
- **Woodcut roll:** a 60px canvas piano-roll between 2px ink rules; parts color-coded (coral chords, black melody on top, olive counter, plum bass) over faint bar rules.
- **Billing lines:** four draggable part rows in wood type (15px/700) with hand-drawn inline-SVG glyphs; hover slides the line 4px right under a coral wash; `DRAG →` hint in 8.5px tracked caps; solo/mute chips appear only on the playing card (solo-on = chartreuse, mute-on = solid ink).
- **States:** hover un-tilts and lifts (−3px, deeper shadow); playing gets a 3px coral outline and the NOW PLAYING stamp (`stampIn`); the card header and every billing line are native OS drag sources — never remove the grab/grabbing cursors.

### Ink Knobs (signature)
- **Style:** SVG rotary, 270° arc from −135°; track in 22%-alpha cream, value arc 4.5px round-capped, cream needle and Big Shoulders numeral in the center; label is a rotated Aged Cream chip. The knob grid sits on an inset plum-paper board inside the cream panel.
- **Ink rotation:** arcs cycle coral / chartreuse / cream by `nth-child(3n)`; while dragging the arc swaps to the opposite ink.
- **Interaction:** vertical drag (pointer capture, `ns-resize`), wheel steps, double-click resets to default.

### Ruler Transport (signature)
- **Style:** full-width Cream Stock bar, upward shadow; the top edge carries printed ruler ticks (two stacked `repeating-linear-gradient` tick rows, minor every 12px, major every 96px) — the bar IS the measuring tool.
- **Play:** 46px coral press wheel; while playing, its shadow pulses coral-deep on a 2.4s linear loop (`pressTurn`).
- **Progress:** an 8px trough between 1.5px ink rules, coral fill scaled by `transform: scaleX()` (80ms linear).
- **Visualizer:** 86×32px canvas of ink bars alternating coral-deep / ink-black — FFT levels for the built-in synth, a beat-locked pulse when routing MIDI out.
- **Controls:** solo/mute chip rows (CH/MEL/CTR/BAS), tempo ticket, LOOP toggle (ghost when off), output and sounds menus.

### Menus, Toasts, Overlays
- **Menu:** a cream slip (2px corners, loose-slip shadow), sentence-case 12px items, coral-wash hover, stamp-red `danger` items, tracked-caps section subheads.
- **Toast:** a crooked cream note (−0.5°) stamped with the `SHOP NOTE` kicker in Coral Deep 8.5px caps; enters via `toastIn`.
- **Dropzone (paste-up wall):** the `pasteup-wall.webp` raster with a tilted cream sheet pinned center; drag-over adds a 3px dashed coral outline to the sheet; analysis stats land as tilted cream stat cards ("what the app heard").
- **Tutorial:** plum scrim (82%), taped poster card entering via `posterUp`, coral ring step medallion rotated −6°.

### Motion — stamps and press pulls
The grammar every new component follows:
- **Entrances are physical:** `stampIn` (scale 1.45→1, 260ms), `pressPull` (drop −18px with −0.8° twist, 450ms), `posterUp` (rise 26px, 350ms), `toastIn` (rise 12px, 240ms). All use the exponential ease-out family — `cubic-bezier(0.16, 1, 0.3, 1)` (or `(0.2, 1.1, 0.3, 1)` with slight overshoot for the press pull). No exit choreography; paper is simply removed.
- **Micro-interactions:** 120–200ms plain `ease` on transform/background/border/color; presses translate, hovers lift or slide.
- **Transform + opacity only;** the only infinite loops are the spinner (`◌`, 1s) and the press wheel's shadow pulse.
- **The Reduced Motion Rule.** `prefers-reduced-motion: reduce` kills every animation and transition globally (`!important`). Never ship motion outside this switch.

## Do's and Don'ts

### Do:
- **Do** put every new surface on one of the two papers and print on it with the established inks — reuse `--paper`, `--cream`, `--ink`, `--coral`, `--chart` tokens, never new hex.
- **Do** tilt new paper elements ±0.3°–2° (alternate by `nth-child` or a stable content hash) and give them exactly one warm plum-black down-right shadow.
- **Do** set names in Big Shoulders uppercase ≥700 and small labels in tracked Libre Franklin caps (≥0.1em).
- **Do** write copy in shop language (pull, print, plates, reprint, Shop Note) — producer-to-producer, never corporate.
- **Do** draw icons as small inline-SVG woodcuts in `currentColor`, or use the established monochrome dingbats (♥ ★ ▶ ■ ⋯ ◌ ↻) — they print in ink like everything else.
- **Do** keep every asset local and bundled (CSP `img-src 'self' data:`, `font-src 'self'`) and keep list-scale surfaces lazy (IntersectionObserver + cache, as the piano-roll does).
- **Do** enter with a stamp or press pull (exponential ease-out, ≤450ms) and respect the global reduced-motion kill switch.

### Don't:
- **Don't** use neon glow, colored halos, or luminous outlines — the retired identity; shadows are plum-black paper shade only (the press wheel's coral shadow pulse is the lone, established exception).
- **Don't** use glassmorphism: no `backdrop-filter`, no frosted translucent panels.
- **Don't** use gradient fills or gradient text; ink is flat. (Repeating-gradient tick/rule *patterns* like the transport ruler are drawing, not washes.)
- **Don't** build tech-dashboard chrome: no pill radii over 4px, no floating rounded widget panels, no status-dot pills, no chart-junk.
- **Don't** use color emoji as icons, icon fonts, or third-party icon packs.
- **Don't** obscure the job: card drag, billing-line drag, audition and search must stay one gesture deep on every screen (Operate-mode commitment).
- **Don't** load anything remote — fonts, images, scripts, tracking. The app is fully offline.
