# Spec: Theme System + Pixel Art Styling + Mascot Integration

## Requirements

### 1. Preset Theme System (7 themes)
- **Pixel Pastel** (default) — matches Lil' Bit's pink/green palette
- **Dark Mode** — dark bg, light text
- **Dracula** — purple/pink/cyan on dark
- **Nord** — cool blue-gray tones
- **Solarized** — warm earth tones
- **Catppuccin** — pastel on dark
- **Retro Game** — green/black terminal-style, heavy pixel feel

Scope: colors, backgrounds, text, accents, card styles, borders, shadows, buttons, sidebar/nav — full app theming.

Persistence: stored in user profile DB (`preferences` JSON field), syncs across devices.

### 2. Pixel Art Font Styling
- Headings: pixel font (e.g., "Silkscreen" or "Press Start 2P" from Google Fonts)
- Body: clean sans-serif (keep existing Geist)
- Pixel decorative accents where appropriate (borders, dividers)

### 3. Mascot Integration (Lil' Bit)
Placements:
- Dashboard welcome section (contextual expression based on state)
- Empty states (no decks, no results)
- 404 page (already exists, update with mascot)
- Loading/transition states
- Anywhere else that makes sense

Available expressions: happy, winking, surprised, sad/angry, smug, sleeping
Source: /Users/kennethsolomon/Desktop/finalily/

### 4. Animation
- CSS animations to make Lil' Bit feel alive (idle bounce, breathing, subtle movement)
- CSS-only approach preferred (no GIF conversion needed)

### 5. Non-Goals
- No custom theme builder (presets only)
- No per-component theme overrides
- No mascot sound effects
