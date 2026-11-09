<p align="center">
  <img src="docs/portfolio-header.png" alt="Pastel liquid-glass portfolio — a guide to making it yours" width="100%">
</p>

<h1 align="center">Your portfolio, made yours.</h1>
<p align="center">A practical guide to editing your content, building the single-file site, and keeping your changes.</p>

<p align="center"><a href="#start-here">Start here</a> · <a href="#edit-your-content">Edit content</a> · <a href="#add-a-project-card">Add a project</a> · <a href="#buttons-and-links">Buttons & links</a> · <a href="#save-your-changes-to-github">Save to GitHub</a></p>

> **This is a private work in progress.** The current name, projects, CV, statistics, and links are sample content. Replace them with your own verified information before sharing the site.

## Start here

The source of most of your content is **[`content.json`](content.json)**. You edit it, run a build, and open the result:

```powershell
node build.cjs
```

Open **[`dist/portfolio.html`](dist/portfolio.html)** in a browser by double-clicking it. That file contains the page's HTML, CSS, and JavaScript; Google Fonts still need an internet connection. You can send or host this one HTML file when you're ready. Do not edit it directly: the next build overwrites it.

**You need:** [Node.js](https://nodejs.org/) installed on your computer. Open PowerShell in the project folder, run `node --version` to check, and then run the build command above. No `npm install` is needed.

### Your editing routine

1. Open `content.json` in an editor such as VS Code.
2. Make your changes and save the file.
3. In PowerShell, run `node build.cjs` from the project folder.
4. Refresh `dist/portfolio.html` in your browser and check your changes.
5. When you are happy, save and push your changes using the [Git steps below](#save-your-changes-to-github).

JSON has a few rules: use double quotes around text, put commas **between** items, and do not put a comma after the last item in a list. If your text contains a double quote, write it as `\"`. Keep a backup or use Git if you are trying a large edit.

## Edit your content

These are the main fields in `content.json`:

| Field | What it changes |
| --- | --- |
| `name` | Your full name in the page title, logo initials, entrance, and footer. |
| `lines` | The separate lines of the large hero name. Update this alongside `name`. |
| `intro` | The short introduction below your name. It currently accepts trusted HTML, such as `<b>AI engineer.</b>`. |
| `status` | The visible label on the CV button. |
| `about` | The About paragraph. |
| `email` | The displayed email, copy button, and Email social link. Change it in this one place. |
| `socials` | Social link labels, destinations, and existing icon names. |
| `skills` | The scrolling skills marquee. |
| `projects` | Project cards and their case studies. |
| `outro` | The closing sentence above your social links. |
| `cv` | The CV heading, introduction, entries, and tags. |

For example, change your name and the lines together:

```json
"name": "Your Full Name",
"lines": ["Your", "Full Name"],
"email": "hello@example.com"
```

The examples in this guide are placeholders too. Use your own details when editing the actual file.

### Social links

Each entry is `[label, destination, icon]`. Change the destination for GitHub or LinkedIn:

```json
"socials": [
  ["Email", "", "email"],
  ["GitHub", "https://github.com/YOUR-USERNAME", "github"],
  ["LinkedIn", "https://www.linkedin.com/in/YOUR-PROFILE/", "linkedin"]
]
```

The Email destination comes from `email`, so leave its middle value empty. The existing icon keys are `email`, `github`, and `linkedin`. Adding a different social icon requires code changes to the icon map in `src/page.js`; merely inventing a new icon key produces no icon.

## Add a project card

Find the `projects` array in `content.json`. Copy an existing project object and paste it **inside the array**, putting a comma between it and the previous object. Replace the example values:

```json
{
  "n": "My Project",
  "y": "2026",
  "t": "A short one-line introduction",
  "d": "A little more detail about what the project does.",
  "w": "lavender",
  "s": ["Python", "TypeScript"],
  "r": ["A real result you can support.", "Another meaningful outcome."],
  "l": [
    ["View project", "https://example.com/"],
    ["Source code", "https://github.com/YOUR-USERNAME/YOUR-REPO"]
  ],
  "c": ["#cdb8ff", "#bfe0ff", "#fff1b8"]
}
```

| Key | Meaning |
| --- | --- |
| `n` | Project name. |
| `y` | Year shown on the card; keep it in quotes. |
| `t` | Short card description. |
| `d` | Additional description in the case study. |
| `w` | Soundscape: `lavender`, `peach`, `mint`, or `aqua`. |
| `s` | Skill tags. |
| `r` | Result bullets. Use evidence-backed claims. |
| `l` | Case-study buttons, each as `[label, link]`. |
| `c` | Three hex colors for the existing decorative artwork. |

Build again to generate the card, case study, and no-JavaScript fallback. Project links are made from the name: `My Project` becomes `#project-my-project`. Give projects distinct names that produce distinct links; renaming one changes its link. Reorder objects to reorder cards, or delete an object to remove a card. Take care with the commas when doing either.

## Buttons and links

### Change or add project buttons

In a project's `l` list, change the first string to rename a button and the second to change where it goes. To add another button, add another pair:

```json
"l": [
  ["View demo", "https://example.com/"],
  ["Read the code", "https://github.com/YOUR-USERNAME/YOUR-REPO"],
  ["Contact me", "#contact"]
]
```

Use an `https://` address for an external page or an existing `#section` anchor such as `#contact`. These buttons appear in that project's case study and its no-JavaScript fallback.

### Change the CV

Inside the `cv` object, edit `title`, `lead`, `items`, and `tags`. Each entry in `items` has a `title`, `meta`, and `description`; copy an entry to add another, with commas between entries. The hero button's visible text is the separate `status` field. The print and contact button labels are in `src/template.html` (`cv-print` and `cv-contact`).

### Change other button or navigation labels

Some interface labels are part of the page structure rather than `content.json`. For example, the navigation labels are present in **both** `src/template.html` (fallback) and the `buildContent()` navigation markup in `src/page.js` (interactive version). Update both to keep them consistent. The CV print and contact button labels are in `src/template.html`.

To add an entirely new button outside a project case study, add an appropriate link or button to `src/template.html`, using the existing nearby markup as a guide. A button that performs a new action also needs interaction code in `src/interaction.js`, including keyboard and accessibility behavior. Rebuild and test both the interactive page and its fallback. This is a code change; adding a project button through `l` is simpler.

## Project map

| Path | Purpose |
| --- | --- |
| `content.json` | Main editable portfolio content. |
| `src/template.html` | Page structure and fixed interface labels. |
| `src/styles.css` | Original visual styles. |
| `src/sound.js` | Soundscape. |
| `src/graphics.js` | WebGL visual effects. |
| `src/page.js` | Content rendering and shared page setup. |
| `src/interaction.js` | Navigation, animation, dialogs, and interactions. |
| `build.cjs` | Combines source and content into the standalone page. |
| `dist/portfolio.html` | Generated file to open or share. |

The scripts are combined in a fixed order and share state, so move code between them carefully. A rebuild updates both the standalone page's initial fallback markup and its embedded interactive data.

## Save your changes to GitHub

After building and reviewing your edits, run these commands from the project folder:

```powershell
git status
git add content.json src dist README.md
git commit -m "Update portfolio content"
git push
```

`git status` lets you review changed files first. Adjust the `git add` paths if you changed other files. If Git asks you to sign in, authenticate with your own GitHub account. The repository is private; uploading changes here does not itself publish a website.

## Troubleshooting

- **The build reports a JSON error:** Check quotes, commas, and matching brackets in `content.json`; an editor with JSON highlighting helps.
- **My change does not appear:** Save the source, run `node build.cjs` again, then refresh `dist/portfolio.html`.
- **A social or project link goes to the wrong place:** Check the URL in the relevant list. For email, edit the main `email` field.
- **A new project link conflicts with another:** Give the projects distinct names, rebuild, and test their links.
- **Fonts look different offline:** The page loads its fonts from Google Fonts when available.
- **Something looks or moves differently after a code edit:** Revert the relevant change or compare it with an earlier Git commit. Test on the browsers and devices you intend to support.
