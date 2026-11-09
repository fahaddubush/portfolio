# Portfolio

This project keeps the supplied portfolio's design and placeholder copy. Edit `content.json`, then run `node build.cjs`. Open `dist/portfolio.html` directly in a browser; it is the distributable single-file build. Google Fonts still require a network connection.

`content.json` is the source for the hero, about text, contact email, social links, skills, projects, and CV. Each project has `n` (name), `y` (year), `t` (short description), `d` (detail), `w` (soundscape: lavender, peach, mint, or aqua), `s` (skills), `r` (results), `l` (label and URL pairs), and `c` (three artwork colors). Project names determine their URL hashes, so changing a name changes its link. The Email social link and copy control use the main email value. `intro` accepts trusted HTML; the remaining copy is plain text. The original examples and claims are placeholders, not verified biography or results.

The build uses Node.js without installed packages. It generates the static fallback and embeds the same content in the interactive page. Do not edit `dist/portfolio.html` directly. The template, styles, sound, graphics, and interactions are in `src/`; their scripts are concatenated in order to preserve the original shared scope and standalone-file behavior.
