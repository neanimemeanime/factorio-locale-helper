# Инструкция для ИИ (AI Guide): Factorio Locale Helper & MCP Server

Этот документ описывает назначение, архитектуру, доступные инструменты MCP и правила взаимодействия с проектом **Factorio Localization Helper**.

---

## 1. Контекст проекта и окружение

- **Стек**: Node.js (ES Modules, `"type": "module"`) + Python 3 (для анализа дубликатов с ванилью 2.1+).
- **Расположение проекта**: `C:\Users\Админ\Desktop\Программирование и Проекты\For soft\old locale helper`
- **Рабочее окружение Factorio**:
  - Папка модов: `%APPDATA%\Factorio\mods` (`c:\Users\Админ\AppData\Roaming\Factorio\mods`)
  - Конфигурация активных модов: `%APPDATA%\Factorio\mods\mod-list.json`
  - Таргет-мод русской локализации: `my-texture-pack` (путь к переводам: `%APPDATA%\Factorio\mods\my-texture-pack\locale\ru\`)
  - Ванильные данные Factorio (Space Age 2.1+): `D:\SteamLibrary\steamapps\common\Factorio\data`
- **Формат файлов**: Factorio `.cfg` (INI-подобный формат: секции `[item-name]`, `[entity-name]` и строки `key=value`).

---

## 2. Инструменты MCP (Model Context Protocol)

MCP-сервер запускается через `node cli.js --mcp` (транспорт: stdio, протокол: JSON-RPC 2.0).
Для ИИ-агентов доступны следующие 4 инструмента:

### 1) `scan_missing_keys` (Пакетный diff недостающих строк)
- **Назначение**: Пакетное сканирование активных модов из `mod-list.json`, извлечение оригинальных английских строк (`locale/en/*.cfg`) из `.zip`-архивов и папок на лету, сравнение с существующей базой в `my-texture-pack/locale/ru/<modName>.cfg` и формирование diff отсутствующих строк.
- **Входные параметры**:
  - `modsDir` *(string, опционально)*: Путь к папке модов. По умолчанию: `%APPDATA%\Factorio\mods`.
  - `targetMod` *(string, default: `"my-texture-pack"`)*: Имя мода-хранилища переводов.
  - `lang` *(string, default: `"ru"`)*: Язык, с которым производится сравнение.
  - `modFilter` / `filter` *(string, опционально)*: Фильтр по названию конкретного мода (например, `"0-things"`).
  - `writeToTarget` *(boolean, default: `true`)*: Автоматически встраивать/мерджить недостающие ключи прямо в существующие `.cfg` файлы в целевом моде `my-texture-pack/locale/ru/<modName>.cfg` (с сохранением структуры секций, комментариев и существующих строк), чтобы исключить ручное копирование.
  - `writeDir` *(string, опционально)*: Отдельная папка, куда дополнительно сохранить заготовки `.cfg` с недостающими строками.
- **Формат ответа**:
  ```json
  {
    "summary": {
      "modsDir": "...",
      "targetMod": "my-texture-pack",
      "targetLang": "ru",
      "totalActiveMods": 198,
      "modsWithMissingKeys": 33,
      "totalMissingKeys": 457,
      "writeToTarget": true,
      "updatedFilesCount": 33,
      "writtenToDir": null
    },
    "mods": {
      "<mod_name>": {
        "ruFileExists": true,
        "missingCount": 2,
        "matchedFile": "0-things_1.2.3.zip",
        "sections": {
          "mod-setting-name": {
            "things-setting-log-level": "Log level"
          }
        }
      }
    }
  }
  ```

---

### 2) `audit_locale_quality` (Аудит качества локализации)
- **Назначение**: Комплексная валидация качества русской базы переводов (`my-texture-pack/locale/ru/*.cfg` или указанной папки):
  1. **Сверка тегов и плейсхолдеров с оригиналом**: автоматическое сравнение с оригинальной английской локалью мода (`locale/en/*.cfg` из zip или папки мода) и выявление пропущенных тегов и плейсхолдеров (например, если в оригинале `[color=green]__1__[/color]/__2__ kg`, а в переводе нет `[color=green][/color]` или `__2__`), а также синтаксических ошибок (незакрытые `[color=...]`, `[font=...]`).
  2. **Поиск символов сторонних языков**: обнаружение иероглифов и знаков других языков (`cn` — китайский, `jp` — японский, `kr` — корейский, арабский и др.).
  3. **Смесь языков (Mixed Language)**: латиница рядом с кириллицей (*"Fill wooden бочка"*).
  4. **Забытый английский (Untranslated)**: чисто английские строки, оставленные в русском файле.
- **Исключения и фильтры (не считаются ошибками)**:
  - Корректные теги Factorio: `[item=...]`, `[fluid=...]`, `[entity=...]`, `[tile=...]`, `[recipe=...]`, `[planet=...]`, `[quality=...]`, `[color=...]`, `[font=...]` и др.
  - Плейсхолдеры: `__1__`, `__ENTITY__...__`, `__CONTROL__...__` и др.
  - Горячие клавиши (`Shift`, `Ctrl`, `Alt`, `WASD`, `Tab`), технические акронимы движка (`GUI`, `FPS`, `UPS`, `API`), аппаратные сокращения (`RAM`, `VRAM`, `CPU`, `GPU`) и технические единицы мощности/частоты (`kW`, `MW`, `kJ`, `RPM`, `GHz`).
  - **Важно:** Все бренды, платформы и названия модов (`Factorio`, `Discord`, `Eneas`, `Foliax`, `FNEI` и др.) **НЕ входят** в белый список и должны переводиться/транслитерироваться на русский язык (`Факторио`, `Дискорд`, `Энеас`, `Фолиакс`). Если они оставлены на латинице, аудит регистрирует это как ошибку.
- **Входные параметры**:
  - `targetPath` *(string, опционально)*: Путь к папке `.cfg`. По умолчанию: `%APPDATA%\Factorio\mods\my-texture-pack\locale\ru`.
  - `modsDir` *(string, опционально)*: Путь к папке модов Factorio (для чтения оригинальных `en/*.cfg`). По умолчанию: `%APPDATA%\Factorio\mods`.
  - `modFilter` / `filter` *(string, опционально)*: Фильтр по названию мода/файла.
  - `issueType` *(enum: `["all", "tags", "foreign", "mixed", "untranslated"]`, default: `"all"`)*:
    - `"tags"`: только несовпадения тегов и плейсхолдеров с оригиналом.
    - `"foreign"`: только символы сторонних языков (китайский, японский и др.).
    - `"mixed"`: смесь латиницы и кириллицы.
    - `"untranslated"`: чисто английский текст в русском файле.
  - `limit` *(number, default: `100`)*: Максимальное число возвращаемых замечаний (передайте `0` для снятия лимита).
- **Формат ответа**:
  ```json
  {
    "summary": {
      "targetLocaleDir": "...",
      "modsDir": "...",
      "totalFilesScanned": 220,
      "totalIssuesFound": 849,
      "tagMismatchCount": 844,
      "foreignCharactersCount": 5,
      "mixedCount": 0,
      "untranslatedCount": 0,
      "returnedCount": 10,
      "hasMore": true
    },
    "issues": [
      {
        "type": "tag_mismatch",
        "file": "planet-rabbasca.cfg",
        "modName": "planet-rabbasca",
        "section": "rabbasca-extra",
        "key": "bunnyhop-weight",
        "text": "вес: __1__ kg",
        "originalText": "Carrying [color=green]__1__[/color]/__2__kg",
        "missingTags": ["[color=green][/color]", "__2__"],
        "extraTags": [],
        "syntaxErrors": [],
        "description": "Отсутствуют в переводе: [color=green][/color], __2__"
      },
      {
        "type": "foreign_characters",
        "file": "planet-rabbasca.cfg",
        "modName": "planet-rabbasca",
        "section": "recipe-name",
        "key": "rabbasca-quality-assurance",
        "text": "提升保险库质量保证",
        "languages": ["cn"],
        "foreignCharacters": ["提升保险库质量保证"],
        "description": "В строке обнаружены символы других языков (cn): 提升保险库质量保证"
      }
    ]
  }
  ```

---

### 3) `analyze_mod` (Анализ отдельного мода и генерация .cfg)
- **Назначение**: Полный статический анализ распакованной папки мода: поиск незарегистрированных строк в `.lua` скриптах, прототипов без локали, удаление ключей, уже существующих в ванили Factorio, и генерация чистого `.cfg`.
- **Входные параметры**:
  - `path` *(string, обязательно)*: Абсолютный путь к распакованной папке мода.
  - `write` *(boolean, default: `false`)*: Записать сгенерированный файл напрямую в папку мода `locale/<lang>/<mod>.cfg`.
  - `lang` *(string, default: `"en"`)*: Код языка.
  - `removeUnused` *(boolean, default: `false`)*: Удалять неиспользуемые ключи.
  - `outputPath` *(string, опционально)*: Путь для сохранения результата.

---

### 4) `manage_duplicates` (Менеджер дубликатов ванили 2.1+)
- **Назначение**: Сверка ключей локали мода с ванильными данными Steam Factorio 2.1+ (модули `core`, `base`, `space-age`, `quality`, `elevated-rails`, `recycler`).
- **Входные параметры**:
  - `path` *(string, обязательно)*: Путь к моду или папке его локали.
  - `action` *(enum: `["status", "comment", "uncomment"]`, default: `"status"`)*:
    - `"status"`: показать список дубликатов с указанием ванильного файла и модуля.
    - `"comment"`: закомментировать дублирующиеся строки символом `#`.
    - `"uncomment"`: раскомментировать обратно.
  - `lang` *(string, default: `"ru"`)*: Язык сверки.

---

## 3. Запуск через командную строку (CLI)

Все операции можно выполнять напрямую через терминал:

```bash
# 1. Пакетное сканирование недостающих строк (все активные моды)
npm run scan
# или с фильтром по моду и сохранением заготовок:
node cli.js --scan-missing --filter 0-things --write-dir "C:\temp\diffs"

# 2. Аудит качества переводов
npm run audit
# только несовпадения тегов и плейсхолдеров (потерянные [color], __1__, __2__):
node cli.js --audit --issue-type tags --limit 20
# только символы сторонних языков (китайский cn, японский jp и др.):
node cli.js --audit --issue-type foreign
# только чисто английские строки с лимитом 20:
node cli.js --audit --issue-type untranslated --limit 20
# проверка конкретного файла/мода:
node cli.js --audit --filter planet-rabbasca

# 3. Управление ванильными дубликатами
npm run duplicates
node cli.js --duplicates --path "c:\Users\Админ\AppData\Roaming\Factorio\mods\my-texture-pack\locale\ru" --action status

# 4. Анализ отдельного мода
node cli.js --path "C:\path\to\mod" --write --lang ru

# 5. Запуск в режиме MCP (JSON-RPC stdio)
npm run mcp
```

---

## 4. Архитектура файлов проекта

| Файл | Назначение |
|---|---|
| `cli.js` | Главный диспетчер CLI, запуск HTTP сервера, обработчик MCP JSON-RPC (`initialize`, `tools/list`, `tools/call`). |
| `zip_reader.js` | Сверхбыстрый in-memory парсер ZIP архивов (seek в Central Directory, `zlib.inflateRawSync`, ~0.28 с на 200+ архивов без дисковых операций). |
| `missing_keys_scanner.js` | Логика парсинга `mod-list.json`, извлечения EN локалей, сверки с `my-texture-pack` и формирования diff. |
| `locale_quality_auditor.js` | Эвристики аудита качества: очистка тегов/плейсхолдеров Factorio, белый список терминов, поиск смеси языков и forgotten EN. |
| `analyzer.js` | Ядро статического анализа Lua файлов мода, извлечение прототипов (`data:extend`) и генерация `.cfg`. |
| `manage_duplicates.py` | Python-скрипт сканирования ванильных файлов Factorio Steam и комментирования дубликатов. |
| `package.json` | Манифест проекта и npm-скрипты (`scan`, `audit`, `mcp`, `cli`, `server`, `duplicates`). |

---

## 5. Памятка для ИИ при генерации переводов

1. **Не затирать существующие переводы**: при дополнении `my-texture-pack/locale/ru/<modName>.cfg` использовать результаты `scan_missing_keys` и добавлять только отсутствующие ключи в соответствующие секции `[section]`.
2. **Соблюдать форматирование тегов**: не переводить и не изменять служебные конструкции `[item=...]`, `[fluid=...]`, `[font=default-bold]`, `[color=yellow]` и плейсхолдеры `__1__`, `__2__`.
3. **Не смешивать языки**: после добавления новых строк запускать `node cli.js --audit --filter <modName>` для валидации качества.
