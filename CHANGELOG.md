# Changelog

All notable changes to **SandLoader** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.1] - 2026-09-22

### Summary
SandLoader 0.4.1 adds full compatibility with **Sandustry 0.5.7**, brings native UI localization for **all 23 languages** supported by the game (with automatic language sync), overhauls the in-game console autocomplete and UX, fixes stale wall outline artifacts on element spawn, eliminates early Webpack/React bridge lockouts, and introduces cross-platform one-click installation scripts.

---

### Added

* **Full 23-Language Game Localization:**
  * Added complete native UI translation catalogues for all 23 languages supported by Sandustry:
    * English (`en`), German (`de`), Russian (`ru`), French (`fr`), Spanish (`es`), Latin American Spanish (`esMX`), Italian (`it`), Brazilian Portuguese (`ptBR`), European Portuguese (`ptPT`), Dutch (`nl`), Danish (`da`), Swedish (`sv`), Norwegian (`no`), Finnish (`fi`), Polish (`pl`), Czech (`cs`), Ukrainian (`uk`), Hungarian (`hu`), Turkish (`tr`), Japanese (`ja`), Korean (`ko`), Simplified Chinese (`zhCN`), and Traditional Chinese (`zhTW`).
  * Full pluralization support for complex plural forms: Slavic 3-form plurals for Russian (`ru`), Ukrainian (`uk`), and Polish (`pl`) (`.one`, `.few`, `.many`), and Czech (`cs`) (`.one`, `.few`, `.other`).
  * Integrated all language catalogues cleanly into [`src/renderer/locales.js`](src/renderer/locales.js) with zero runtime dependencies.
* **Automatic In-Game Language Tracking:**
  * SandLoader now dynamically mirrors the game's active language setting via `FH.i18n.getLocale()` and `SMLN.i18n.onChange`.
  * Removed the redundant manual language `<select>` dropdown from the mod manager. Changing language in Sandustry's settings immediately updates SandLoader menus, dialogs, and overlays in real time.
* **Main Menu Maps Label Patch:**
  * Added core patch `smln:maps-menu-label` in [`src/patch/core-patches.js`](src/patch/core-patches.js) to localize the main menu "Maps" entry based on the active SandLoader locale.
* **Cross-Platform One-Click Installers ("Easy Install"):**
  * Added `Easy-Install-Windows.bat`, `Easy-Install-Linux.sh`, and `Easy-Install-MacOS.command` backed by [`tools/easy-install.ps1`](tools/easy-install.ps1).
  * Automatically fetches portable Node.js into a local `vendor/` directory, validates official SHA-256 checksums from `nodejs.org`, locates Steam and GOG game directories, and attaches the loader without requiring Node.js or Git pre-installed.

---

### Changed

* **Archive Detection Hierarchy (Sandustry 0.5.7 Compatibility):**
  * Updated [`src/asar/locate.js`](src/asar/locate.js) and [`src/boot/bootstrap.js`](src/boot/bootstrap.js) to prioritize `app.asar` over leftover `game.asar` files.
  * When Steam updates Sandustry to 0.5.7, it places a fresh `app.asar`. SandLoader now correctly targets the live archive rather than launching against outdated 0.3-era leftovers.
  * Added `locate.fallbackArchive()` helper to resolve live versus parked original archives reliably.
* **Legacy 0.3 Bootstrap Parking:**
  * In [`install.js`](install.js), existing `resources/app` folders from SandLoader 0.3 are safely moved to `resources/app.smln-legacy` to prevent Electron from loading the obsolete bootstrap against stale archives.
* **Default Mod State:**
  * Unconfigured mods (without explicit state in `%AppData%\sandustry\smln\config\mods.json`) now default to **disabled** (`mod.enabled = false`). Bundled example mods no longer automatically enable on the first boot.
* **Console Rail Scrolling:**
  * Removed the hard-coded 12-item slice (`filtered.slice(0, 12)`). The suggestion rail now displays and scrolls through all matching commands and materials.

---

### Fixed

* **Console Navigation & UX ([`src/renderer/console.js`](src/renderer/console.js)):**
  * `ArrowUp` / `ArrowDown` navigate command **history** by default. Opening the console and pressing Up immediately recalls previous commands (e.g. `spawn steam 10`).
  * Pressing `Tab` activates the suggestion rail on the right; once Tab-activated, `ArrowUp` / `ArrowDown` navigate through the suggestions without mutating input text.
  * Pressing `Enter` or `Tab` while a suggestion is focused accepts it into the input. Pressing `Escape` unselects the suggestion rail and returns to history navigation mode.
  * Introduced `historyDraft` to preserve uncommitted text: navigating up into history and back down restores the user's unfinished draft.
* **Gas Pipes v1.4.1 Compatibility & Build Menu Category Renaming:**
  * Updated bundled Gas Pipes to v1.4.1 for Sandustry 0.5.7 compatibility, adapting the pump predicate to allow both Liquid and Gas with the typed `liquidBuffer`.
  * Dynamically renames the Build menu category "Fluids" (`ui|management|category|fluids`) to "Liquids and gases" (e.g. "Жидкости и газы" in Russian) across all 23 supported languages when Gas Pipes is enabled. Implemented via bundle interceptor patches and `SMLN.register.translations` with fallback ASAR reading.
* **Spawn Outline / Shadow Refresh & Safe Spawn Phantom Protection ([`src/renderer/console.js`](src/renderer/console.js)):**
  * Fixed an issue where spawning terrain or wall elements left stale black outline shadow bytes on adjacent foundation and wall cells by computing the touched bounding box and invoking `FH().shadows.refreshRect()`.
  * Fixed an issue where spawning materials over existing buildings, machines, or pipes overwrote simulation cells, creating orphaned renderer "phantoms" with broken shadows and no collision.
  * Added `isCellBlockedByStructure()` (checking `FH.structures.hasBuiltAtCell`, `FH.structures.getAtCell`, and `FH.pipes.isAt`), `isCellEmpty()` simulation checks, and `isInsideWorld()` coordinate guards.
  * Occupied structure and pipe cells are now safely rejected, preserving player buildings and machines intact.
* **Webpack and React Bridge Early-Query Lockout:**
  * Removed `attempted = true` on initial miss in [`src/renderer/webpack-bridge.js`](src/renderer/webpack-bridge.js) and [`src/renderer/react-bridge.js`](src/renderer/react-bridge.js).
  * When mods run before the game bundle has initialized `self.webpackChunksand_v1`, the bridges now safely retry upon bundle readiness rather than permanently freezing with "no webpack chunk array".
  * Warning logs are deferred until `game:ready`.
* **Fluxloader Content RPC Fallback:**
  * Registered an empty fallback handler for `smln:flux-content` in [`src/main/entry.js`](src/main/entry.js). Avoids logging misleading "unknown action" errors when booting without Fluxloader mods installed.
* **Splash Screen Duplicate Capture Notification:**
  * Guarded the splash screen against duplicate "game API captured" lines caused by consecutive `game:ready` and `game:started` events.
* **DOM Test Harness & Test Stability ([`tools/dom-harness.js`](tools/dom-harness.js)):**
  * Removed `doc._all` from query search pools, scoping selector resolution strictly to the queried root subtree to eliminate stale DOM element matching.
  * Added support for compound class selectors (e.g. `.s.sel`), implemented `querySelectorAll` / `_findAll`, and bound `win.document = doc`.
* **Real-Time Language Switching in Game and Menus:**
  * Fixed an issue where non-English/non-Russian languages were stuck on English fallback when switching languages in-game. When mods pre-registered translations for unvisited locales via `FH.i18n.register`, Sandustry's chunk loader `D` previously skipped loading the base `./${locale}.json` chunk because `C[locale]` was already an object.
  * Added core patch `smln:i18n-locale-merge` in [`src/patch/core-patches.js`](src/patch/core-patches.js) to verify `__baseLoaded` and safely merge official game locale chunks with mod-registered strings.
  * Added core patch `smln:i18n-on-locale-change` to expose the game's internal `(0,we.oQ)` locale listener on `FH.i18n.onLocaleChange`.
  * Updated [`src/renderer/i18n.js`](src/renderer/i18n.js) to hook `onLocaleChange` and wrap `setLocale`, updating `SMLN.menuLabel`, `SMLN.mapsLabel`, and all SandLoader overlays synchronously in real time.
  * Enhanced `rewriteMenuText` to match both SandLoader labels and vanilla game strings (`Mods`, `Модификации`, etc.) with retry timers to prevent stale button labels.

---

### Verification

* **Self-Test Suite (`node tools/selftest.js`):**
  * **295 passed, 0 failed** (Exit Code: 0).
  * Validated shadow attach, ASAR fallback precedence, console suggestion and history navigation, safe spawn cell and structure protection, DOM queries, IPC bridges, Gas Pipes category renaming across 23 languages, i18n locale merge & real-time onLocaleChange patches, and all 23 language dictionaries.
