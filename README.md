# Factorio Mod Localization Helper & MCP Server

High-performance toolkit and **Model Context Protocol (MCP)** server for analyzing, batch-scanning missing keys, validating syntax, auditing translation quality, and managing vanilla duplicates for **Factorio 2.1+ (Space Age)** mods.

---

## Features

### 1. Batch Missing Key Scanner (`scan_missing_keys` / `npm run scan`)
- **Fast In-Memory Extraction**: Reads `locale/en/*.cfg` on the fly from active mods in `mod-list.json` across hundreds of `.zip` archives and unpackaged directories in milliseconds without temporary files.
- **Accurate Diffing**: Compares extracted English strings with existing target localization files (`locale/<lang>/<modName>.cfg`).
- **Auto-Merge**: Optionally appends missing keys directly into the target mod (`--write-to-target`), maintaining section order and comments.

### 2. Syntax Validator & Auto-Fixer (`validate_locale_syntax` / `npm run syntax`)
- **Factorio 2.1+ Engine Compliance**: Validates `.cfg` files against canonical prototype engine specifications.
- **Auto-Fix Mode (`--fix`)**: Automatically migrates non-canonical pseudo-sections (such as `[artillery-projectile-name]`, `[planet-name]`, `[unit-name]`) into canonical sections (`[entity-name]`, `[space-location-name]`).
- **Syntax Health Checks**: Detects unclosed brackets, missing delimiters, duplicate sections, and invalid section headers.

### 3. Locale Quality Auditor (`audit_locale_quality` / `npm run audit`)
- **Tag & Placeholder Verification**: Cross-references translated strings with original English strings to catch missing or broken `[color=...]`, `[font=...]`, `[item=...]`, and `__1__`, `__2__` parameters.
- **Foreign Character Detection**: Flags non-target scripts (Chinese, Japanese, Korean, Arabic, etc.).
- **Mixed Language Detection**: Detects accidental mixes of Latin and non-Latin text (e.g. *"wooden бочка"*).
- **Untranslated Text Detection**: Flags English text inadvertently left in translated files.
- **Factorio-Aware Whitelist**: Smart filtering for engine rich text tags, keybindings (`Shift`, `Ctrl`, `WASD`), system acronyms (`GUI`, `FPS`, `UPS`), hardware terms, and scientific units (`kW`, `MW`, `kJ`).

### 4. Mod Prototype Analyzer (`analyze_mod` / `npm run cli`)
- **Static Lua & Prototype Analysis**: Inspects mod scripts (`data:extend`, `data-updates.lua`) and discovers unlocalized prototypes without booting the game.
- **Vanilla Filtering**: Leverages `vanilla_loader.js` to cross-reference compound keys `(section, key)` across all 6 official Factorio 2.1+ modules (`core`, `base`, `space-age`, `quality`, `elevated-rails`, `recycler`) to eliminate false positives.

### 5. Vanilla Duplicate Manager (`manage_duplicates` / `npm run duplicates`)
- Cross-references mod locale files with official Steam Factorio 2.1+ vanilla files.
- Safely comments out (`#`) redundant vanilla overrides while preserving custom planetary and mod overrides (`# MOD OVERRIDE`).

### 6. Model Context Protocol (MCP) Server (`npm run mcp`)
- Standard JSON-RPC 2.0 stdio server providing 5 tools for AI coding assistants (**Claude Desktop, Cursor, Google Antigravity, VS Code MCP**).

### 7. Interactive Factorio-Themed Web GUI (`npm run dev` / `npm run server`)
- Authentic Factorio industrial visual theme powered by React 19 and Vite.
- Master-detail explorer, side-by-side diff view, raw `.cfg` editor, one-click copy, and download actions.

---

## Quick Start

### Prerequisites
- **Node.js 20+**
- **Python 3.10+** (optional, for standalone duplicate manager)

### Installation
```bash
git clone https://github.com/your-username/factorio-mod-locale-helper.git
cd factorio-mod-locale-helper
npm install
```

### Configuration (Optional)
The project automatically resolves sensible defaults based on your operating system. If you want custom paths:

1. Copy `config.example.json` to `config.json`:
   ```bash
   cp config.example.json config.json
   ```
2. Adjust the settings:
   ```json
   {
     "modsDir": "C:\\Users\\User\\AppData\\Roaming\\Factorio\\mods",
     "targetMod": "my-localization-mod",
     "targetLang": "ru",
     "factorioData": "D:\\SteamLibrary\\steamapps\\common\\Factorio\\data"
   }
   ```
Alternatively, set environment variables: `FACTORIO_MODS`, `FACTORIO_TARGET_MOD`, `FACTORIO_TARGET_LANG`, or `FACTORIO_DATA`.

---

## Available Commands

| Command | Description |
|---|---|
| `npm run scan` | Run batch missing key scanner on all active mods |
| `npm run audit` | Run quality audit on target localization files |
| `npm run syntax` | Validate syntax of all `.cfg` files |
| `npm run syntax:fix` | Automatically fix syntax errors and pseudo-sections |
| `npm run mcp` | Launch the Model Context Protocol stdio server |
| `npm run server` | Launch the local HTTP API backend server (port 3001) |
| `npm run dev` | Launch the Vite web dashboard in development mode |
| `npm run build` | Compile the web interface bundle into `dist/` |
| `npm run duplicates` | Run the Python vanilla duplicate manager |
| `npm test` | Execute full automated test suite (23 unit tests) |

---

## CLI Examples

```bash
# Scan missing keys for a specific mod and write to disk
node cli.js --scan-missing --filter planet-rabbasca --write-dir ./diffs

# Validate and automatically repair all .cfg files in a directory
node cli.js --validate-syntax --fix --path "./locale/ru"

# Audit quality for missing tags and placeholders only
node cli.js --audit --issue-type tags --limit 20

# Run static analysis on an unpacked mod
node cli.js --path "../mods/sample-mod" --write --lang ru
```

---

## MCP Server Integration

To use the tool with **Claude Desktop**, add the server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "factorio-locale-helper": {
      "command": "node",
      "args": [
        "C:\\path\\to\\factorio-mod-locale-helper\\cli.js",
        "--mcp"
      ]
    }
  }
}
```

For AI agents, see the complete guide in [AI_GUIDE.md](AI_GUIDE.md).

---

## Running Tests

The test suite covers prototype categorization, Lua AST parsing, in-memory zip reading, syntax correction, and vanilla filtering:

```bash
npm test
```

---

## License

MIT License. See [LICENSE](LICENSE) for details. Factorio is a trademark of Wube Software.
