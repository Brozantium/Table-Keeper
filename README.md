# Table Keeper

Table Keeper is a local-first D&D 5e toolkit that runs both as a standalone web application and as an [Owlbear Rodeo](https://www.owlbear.rodeo/) extension.

It includes the existing character builder and interactive sheet, homebrew tools, dice, rules reference, 2014 and 2024 rulesets, and the DM Table Corner. The Owlbear integration adds room synchronization, player and party awareness, and character-token metadata.

## Requirements

- Node.js 22 or newer
- pnpm 10 or newer

## Local development

```bash
pnpm install
pnpm typecheck
pnpm build
```

The Figma Make environment starts its own development server. Outside that environment, use `pnpm dev`.

Production files are written to `dist/`. The build includes the complete reference library, `manifest.json`, the Owlbear background page, `.nojekyll`, and a GitHub Pages fallback page.

## Configurable deployment path

Vite uses `/` by default. To build beneath a repository or another subdirectory, provide a leading and trailing slash:

```bash
BASE_PATH=/your-chosen-path/ pnpm build:pages
```

The GitHub Actions workflow calculates this automatically from the repository name. Repositories named `*.github.io` use `/`; project repositories use `/<repository-name>/`.

## Create a new GitHub repository

This project intentionally contains no GitHub remote, owner, repository name, or deployment URL.

1. Create an empty repository in the GitHub account or organization you choose.
2. In this local project, add that repository as a remote:

   ```bash
   git remote add origin <your-new-repository-url>
   git branch -M main
   git push -u origin main
   ```

3. On GitHub, open **Settings → Pages**.
4. Under **Build and deployment → Source**, select **GitHub Actions**.
5. Run the **Deploy Table Keeper to GitHub Pages** workflow, or push to `main`.

No repository name or owner needs to be added to the source code.

## Install in Owlbear Rodeo

After GitHub Pages finishes deploying:

1. Open the deployed `manifest.json` in a browser and confirm it returns JSON.
2. Copy its complete hosted URL. It will resemble either:
   - `https://<account>.github.io/manifest.json` for a user or organization Pages repository, or
   - `https://<account>.github.io/<repository>/manifest.json` for a project repository.
3. In Owlbear Rodeo, add a custom extension using that manifest URL.

Manifest resources use paths relative to `manifest.json`, so the same manifest works at a root domain or repository subpath.

## Owlbear integration

- Official `@owlbear-rodeo/sdk`
- Action popover retaining the complete application
- Background room synchronization
- GM persistence through room metadata where the synchronized state fits Owlbear metadata limits
- Live broadcast synchronization for larger room state
- Player identity, role, party, and theme integration
- Character summaries in player metadata
- Character-to-token linking with scene and permission checks

Characters and homebrew remain local-first. Shared campaign-table records are synchronized only for users in the current Owlbear room.

## Data and optional services

Core functionality uses browser storage and requires no private credentials. The imported application includes optional online account and sharing capabilities; those controls are available only when their corresponding service configuration is present. A repository owner who enables external services is responsible for configuring secrets outside source control and updating the privacy documentation for that deployment.

Never commit `.env` files or service credentials.

## Content and attribution

Reference content and mechanics are preserved. SRD attribution and third-party icon credits remain in the application’s reference and credits pages. Table Keeper is not affiliated with or endorsed by Wizards of the Coast or Owlbear Rodeo.

The Table Keeper mark, extension icon, landing illustrations, and theme textures in this repository are original project assets. Licensed reference icons remain documented on the in-app credits page.

No software license has been selected for this development project. Choose and add an appropriate license before accepting external contributions or redistributing code.
