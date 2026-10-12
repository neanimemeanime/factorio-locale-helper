# AI Agent Guide: Factorio Mod Localization Helper & MCP Server

This document outlines the architecture, tool specifications, and guidelines for AI agents interacting with the **Factorio Mod Localization Helper** via MCP (Model Context Protocol) or CLI.

---

## 1. Project Overview & Architecture

- **Runtime Environment**: Node.js 20+ (ES Modules, `"type": "module"`), Python 3.10+ (for duplicate management).
- **Target Game Engine**: Factorio 2.1+ Space Age (default prototype rules, space locations, quality, elevated rails).
- **Configuration Loading**: Dynamically managed by `config_loader.js`:
  1. `config.json` (root directory, git-ignored)
  2. Environment variables: `FACTORIO_MODS`, `FACTORIO_TARGET_MOD`, `FACTORIO_TARGET_LANG`, `FACTORIO_DATA`
  3. Automatic local detection: resolves active mods folder from OS defaults and detects local pack folders.
  4. Fallback defaults: generic `locale-mod` with `%APPDATA%/Factorio/mods`.

### Core Modules

| Module | Purpose |
|---|---|
| `cli.js` | Main entry point, CLI argument dispatcher, HTTP API server, and MCP JSON-RPC 2.0 stdio handler. |
| `config_loader.js` | Zero-configuration loader resolving user paths, environment variables, and fallback settings. |
| `missing_keys_scanner.js` | High-speed batch diffing of active mods against target localization `.cfg` files. |
| `syntax_validator.js` | AST & regex engine validating `.cfg` syntax and auto-migrating pseudo-sections to Factorio 2.1+ canonical sections. |
| `locale_quality_auditor.js` | Translation quality auditing (tag matching, foreign scripts, mixed language, untranslated English). |
| `analyzer.js` | Static Lua AST & prototype analyzer extracting unlocalized keys and generating clean `.cfg` files. |
| `vanilla_loader.js` | Scans official Factorio 2.1+ modules (`core`, `base`, `space-age`, etc.) to filter out vanilla keys. |
| `zip_reader.js` | In-memory ZIP parser (~0.28s for 200+ archives without disk extraction). |
| `manage_duplicates.py` | Python utility for checking and safely commenting out duplicate vanilla keys. |

---

## 2. MCP Tools Specification

The MCP server runs via `node cli.js --mcp` (stdio transport, JSON-RPC 2.0).

### 1) `scan_missing_keys`
Performs batch scanning of all active mods from `mod-list.json`. Extracts English `.cfg` files from `.zip` archives and folders on the fly, compares them with the target localization mod, and identifies missing keys.

- **Parameters**:
  - `modsDir` *(string, optional)*: Factorio mods folder. Defaults to resolved system path.
  - `targetMod` *(string, optional)*: Target localization mod directory name. Defaults to configured target.
  - `lang` *(string, optional, default: `"ru"`)*: Target language code.
  - `modFilter` *(string, optional)*: Filter for a specific mod name (e.g. `"planet-rabbasca"`).
  - `writeToTarget` *(boolean, optional, default: `false`)*: Automatically append missing keys directly into the corresponding `.cfg` file in the target mod.
  - `writeDir` *(string, optional)*: Optional output folder to save `.cfg` diff drafts.

- **Return Format**:
  ```json
  {
    "summary": {
      "modsDir": "...",
      "targetMod": "...",
      "targetLang": "ru",
      "totalActiveMods": 203,
      "modsWithMissingKeys": 0,
      "totalMissingKeys": 0,
      "writeToTarget": false,
      "updatedFilesCount": 0,
      "writtenToDir": null
    },
    "mods": {
      "mod-name": {
        "ruFileExists": true,
        "missingCount": 2,
        "matchedFile": "mod-name_1.0.0.zip",
        "sections": {
          "mod-setting-name": {
            "setting-key": "Setting Name"
          }
        }
      }
    }
  }
  ```

---

### 2) `validate_locale_syntax`
Validates Factorio `.cfg` files for syntax compliance and non-canonical section headers.

- **Parameters**:
  - `path` *(string, optional)*: File or folder to validate. Defaults to target localization directory.
  - `fix` *(boolean, optional, default: `false`)*: Automatically fix errors and migrate non-canonical sections.
  - `verbose` *(boolean, optional, default: `false`)*: Detailed reporting.

- **Non-Canonical Section Migration Mapping**:
  - `[artillery-projectile-name]` → `[entity-name]`
  - `[fire-name]` → `[entity-name]`
  - `[planet-name]` → `[space-location-name]`
  - `[turret-name]` → `[entity-name]`
  - `[unit-name]` → `[entity-name]`
  - `[wall-name]` → `[entity-name]`
  - `[tool-name]` → `[item-name]`
  - `[corpse-name]` → `[entity-name]`
  - `[remnant-name]` → `[entity-name]`
  - `[explosion-name]` → `[entity-name]`

---

### 3) `audit_locale_quality`
Audits translation quality, verifies placeholder parity, and detects foreign or unlocalized content.

- **Parameters**:
  - `targetPath` *(string, optional)*: Path to the target `.cfg` directory.
  - `modsDir` *(string, optional)*: Factorio mods directory (used to read original `locale/en/*.cfg` references).
  - `modFilter` *(string, optional)*: Filter by mod name or filename.
  - `issueType` *(enum: `["all", "tags", "foreign", "mixed", "untranslated"]`, default: `"all"`)*:
    - `"tags"`: Only tag and placeholder mismatches (e.g. missing `[color=...]`, `__1__`).
    - `"foreign"`: Only foreign characters (Chinese, Japanese, Korean, Arabic).
    - `"mixed"`: Only mixed Latin and Cyrillic/non-Latin scripts.
    - `"untranslated"`: Only purely English lines left in translated files.
  - `limit` *(number, optional, default: `100`)*: Max number of issues to return (`0` for unlimited).

---

### 4) `analyze_mod`
Performs static Lua AST analysis on an unpacked mod directory. Extracts unlocalized strings, analyzes prototypes, filters vanilla keys, and outputs a clean `.cfg`.

- **Parameters**:
  - `path` *(string, required)*: Absolute path to the unpacked mod root directory.
  - `write` *(boolean, optional, default: `false`)*: Write generated `.cfg` directly to `locale/<lang>/<mod>.cfg`.
  - `lang` *(string, optional, default: `"en"`)*: Target language code.
  - `removeUnused` *(boolean, optional, default: `false`)*: Remove unused keys from existing locale file.
  - `outputPath` *(string, optional)*: Custom output path for the `.cfg` file.

---

### 5) `manage_duplicates`
Cross-references mod locale keys with official Factorio Steam vanilla files and manages redundant definitions.

- **Parameters**:
  - `path` *(string, required)*: Path to mod directory or `.cfg` file.
  - `action` *(enum: `["status", "comment", "uncomment"]`, default: `"status"`)*:
    - `"status"`: Report duplicate keys and their vanilla origins.
    - `"comment"`: Comment out duplicates with `#`.
    - `"uncomment"`: Uncomment previously commented duplicates.
  - `lang` *(string, optional, default: `"ru"`)*: Language code.
  - `vanillaPath` *(string, optional)*: Path to Factorio `data` directory.

---

## 3. Best Practices for AI Agents Generating Translations

1. **Preserve Rich Text & Parameters**: Never translate or alter engine placeholders:
   - Rich text tags: `[item=...]`, `[fluid=...]`, `[entity=...]`, `[planet=...]`, `[color=...]`, `[font=...]`
   - Positional parameters: `__1__`, `__2__`, etc.
   - Control parameters: `__CONTROL__<action>__`, `__ENTITY__<name>__`
2. **Preserve Mod Overrides**: Lines commented with `# MOD OVERRIDE` or `# FOUND IN LUA` represent deliberate overrides and must not be deleted.
3. **Use Canonical Sections**: In Factorio 2.1+, prototypes are grouped under canonical categories:
   - Buildings, units, turrets, corpses → `[entity-name]`, `[entity-description]`
   - Items, tools, modules → `[item-name]`, `[item-description]`
   - Planets, moons, space platforms → `[space-location-name]`, `[space-location-description]`
   - Mod settings → `[mod-setting-name]`, `[mod-setting-description]`
4. **Post-Translation Verification**: Always execute `validate_locale_syntax` and `audit_locale_quality` on edited files before completing your task.
