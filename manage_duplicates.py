import os
import sys
import glob
import argparse

# ---------------------------------------------------------------------------
# Factorio Steam paths detection
# ---------------------------------------------------------------------------
DEFAULT_STEAM_DATA_PATHS = [
    r"D:\SteamLibrary\steamapps\common\Factorio\data",
    r"C:\Program Files (x86)\Steam\steamapps\common\Factorio\data",
    r"C:\Program Files\Steam\steamapps\common\Factorio\data",
    r"E:\SteamLibrary\steamapps\common\Factorio\data",
]

def find_steam_factorio_data():
    env_path = os.environ.get("FACTORIO_DATA")
    if env_path and os.path.isdir(env_path):
        return env_path
    
    for path in DEFAULT_STEAM_DATA_PATHS:
        if os.path.isdir(path):
            return path
    return None

STEAM_DATA_DIR = find_steam_factorio_data() or r"D:\SteamLibrary\steamapps\common\Factorio\data"

# Standard modules in Factorio 2.1+ Space Age
KNOWN_MODULES = ["core", "base", "space-age", "quality", "elevated-rails", "recycler"]

# Default mod directory
DEFAULT_MOD_LOCALE_DIR = r"c:\Users\Админ\AppData\Roaming\Factorio\mods\my-texture-pack\locale\ru"

def parse_cfg_file(filepath):
    parsed = {}
    current_section = None
    try:
        with open(filepath, 'r', encoding='utf-8-sig', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith(';') or line.startswith('#'):
                    continue
                if line.startswith('[') and line.endswith(']'):
                    current_section = line[1:-1].strip()
                    continue
                if '=' in line and current_section:
                    parts = line.split('=', 1)
                    key = parts[0].strip()
                    val = parts[1].strip()
                    parsed[(current_section, key)] = val
    except Exception as e:
        print(f"Ошибка при чтении {filepath}: {e}")
    return parsed

def load_vanilla_keys(data_dir=STEAM_DATA_DIR, lang="ru"):
    """
    Scans all vanilla modules in Steam Factorio data directory for locale .cfg files.
    """
    vanilla_keys = {}
    modules_found = []

    if not os.path.exists(data_dir):
        print(f"ВНИМАНИЕ: Папка данных Factorio не найдена: {data_dir}")
        return vanilla_keys, modules_found

    # Look through known modules and any extra directories containing locale/<lang>
    for entry in os.listdir(data_dir):
        module_path = os.path.join(data_dir, entry)
        if not os.path.isdir(module_path) or entry.startswith('.'):
            continue

        locale_dir = os.path.join(module_path, "locale", lang)
        cfg_files = []
        if os.path.isdir(locale_dir):
            cfg_files = glob.glob(os.path.join(locale_dir, "**", "*.cfg"), recursive=True)

        # Also check nested campaigns / scenarios / tutorials in base
        campaigns_dir = os.path.join(module_path, "campaigns")
        if os.path.isdir(campaigns_dir):
            cfg_files.extend(glob.glob(os.path.join(campaigns_dir, "**", "locale", lang, "**", "*.cfg"), recursive=True))

        scenarios_dir = os.path.join(module_path, "scenarios")
        if os.path.isdir(scenarios_dir):
            cfg_files.extend(glob.glob(os.path.join(scenarios_dir, "**", "locale", lang, "**", "*.cfg"), recursive=True))

        tutorials_dir = os.path.join(module_path, "tutorials")
        if os.path.isdir(tutorials_dir):
            cfg_files.extend(glob.glob(os.path.join(tutorials_dir, "**", "locale", lang, "**", "*.cfg"), recursive=True))

        if cfg_files:
            modules_found.append(entry)
            for cfg_file in cfg_files:
                rel_path = os.path.relpath(cfg_file, module_path)
                file_keys = parse_cfg_file(cfg_file)
                for (sec, key), val in file_keys.items():
                    if (sec, key) not in vanilla_keys:
                        vanilla_keys[(sec, key)] = []
                    vanilla_keys[(sec, key)].append({
                        "module": entry,
                        "file": rel_path,
                        "value": val
                    })

    return vanilla_keys, modules_found

def is_protected_key(lines, idx):
    """
    Checks if the key at idx is preceded by developer warning comments:
    FOUND IN LUA, DYNAMIC LOCALIZATION, or MISSING IN LOCALE.
    """
    for j in range(idx - 1, -1, -1):
        prev_line = lines[j].strip()
        if not prev_line:
            continue
        if prev_line.startswith('#') or prev_line.startswith(';'):
            upper_line = prev_line.upper()
            if "FOUND IN LUA" in upper_line or "DYNAMIC LOCALIZATION" in upper_line or "MISSING IN LOCALE" in upper_line:
                return True
            if '=' in prev_line:
                break
        else:
            break
    return False

def resolve_target_dir(raw_path, lang="ru"):
    """
    Resolves drag-and-dropped folder or given path to the proper locale directory.
    """
    cleaned = raw_path.strip().strip('"').strip("'")
    if not os.path.exists(cleaned):
        return cleaned

    # If it's a file, point to its directory
    if os.path.isfile(cleaned):
        return os.path.dirname(cleaned)

    # If user provided mod root containing locale/<lang>
    cand_locale_lang = os.path.join(cleaned, "locale", lang)
    if os.path.isdir(cand_locale_lang):
        return cand_locale_lang

    cand_locale = os.path.join(cleaned, "locale")
    if os.path.isdir(cand_locale):
        sub_lang = os.path.join(cand_locale, lang)
        if os.path.isdir(sub_lang):
            return sub_lang
        return cand_locale

    return cleaned

def process_files(target_dir, vanilla_keys, action):
    if not os.path.exists(target_dir):
        print(f"Ошибка: Директория мода не найдена: {target_dir}")
        return 0, 0

    mod_cfg_files = glob.glob(os.path.join(target_dir, "**", "*.cfg"), recursive=True)
    if not mod_cfg_files:
        print(f"В директории {target_dir} не найдено .cfg файлов!")
        return 0, 0

    total_duplicates = 0
    total_modified = 0

    for filepath in mod_cfg_files:
        rel_path = os.path.relpath(filepath, target_dir)
        lines = []
        modified = False
        current_section = None

        try:
            with open(filepath, 'r', encoding='utf-8-sig', errors='ignore') as f:
                lines = f.readlines()
        except Exception as e:
            print(f"Ошибка чтения {rel_path}: {e}")
            continue

        new_lines = []
        for line_idx, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith('[') and stripped.endswith(']'):
                current_section = stripped[1:-1].strip()
                new_lines.append(line)
                continue

            if not current_section or '=' not in line:
                new_lines.append(line)
                continue

            # Check if active or commented key
            is_commented = stripped.startswith('#') or stripped.startswith(';')
            if is_commented:
                inner = stripped[1:].strip()
                if '=' in inner:
                    parts = inner.split('=', 1)
                    key = parts[0].strip()
                    val = parts[1].strip()
                else:
                    new_lines.append(line)
                    continue
            else:
                parts = stripped.split('=', 1)
                key = parts[0].strip()
                val = parts[1].strip()

            # Is it a duplicate of vanilla?
            if (current_section, key) in vanilla_keys:
                if is_protected_key(lines, line_idx):
                    new_lines.append(line)
                    continue

                total_duplicates += 1

                if action == "status":
                    status_str = "ЗАКОММЕНТИРОВАН" if is_commented else "АКТИВЕН"
                    print(f"[{status_str}] {rel_path} -> [{current_section}] {key} = {val}")
                    for v in vanilla_keys[(current_section, key)]:
                        print(f"   -> Ваниль ({v['module']}): {v['value']}")
                    new_lines.append(line)
                elif action == "comment":
                    if not is_commented:
                        indent = line[:len(line) - len(line.lstrip())]
                        new_line = indent + "#" + stripped + "\n"
                        new_lines.append(new_line)
                        modified = True
                        total_modified += 1
                        print(f"[КОММЕНТИРОВАНИЕ] {rel_path} -> [{current_section}] #{key}={val}")
                    else:
                        new_lines.append(line)
                elif action == "uncomment":
                    if is_commented:
                        indent = line[:len(line) - len(line.lstrip())]
                        new_line = indent + inner + "\n"
                        new_lines.append(new_line)
                        modified = True
                        total_modified += 1
                        print(f"[РАСКОММЕНТИРОВАНИЕ] {rel_path} -> [{current_section}] {key}={val}")
                    else:
                        new_lines.append(line)
            else:
                new_lines.append(line)

        if modified and action in ("comment", "uncomment"):
            try:
                with open(filepath, 'w', encoding='utf-8-sig') as f:
                    f.writelines(new_lines)
            except Exception as e:
                print(f"Ошибка при записи {rel_path}: {e}")

    return total_duplicates, total_modified

def main_menu(current_mod_dir, vanilla_keys, modules_found, lang="ru"):
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

    target_dir = current_mod_dir

    while True:
        os.system('cls' if os.name == 'nt' else 'clear')
        print("==================================================================")
        print("     Factorio Locale Duplicates Manager (Steam 2.1+ Edition)      ")
        print("==================================================================")
        print(f"  Источник ванили: {STEAM_DATA_DIR}")
        print(f"  Модули Factorio: {', '.join(modules_found) if modules_found else 'НЕ НАЙДЕНЫ!'}")
        print(f"  Уникальных ванильных ключей ({lang}): {len(vanilla_keys)}")
        print(f"  Целевая папка мода: {target_dir}")
        print("==================================================================")
        print()
        print("  1. Показать список текущих дубликатов")
        print("  2. Закомментировать все дубликаты ванили (#)")
        print("  3. Раскомментировать все дубликаты ванили (восстановить)")
        print("  4. Сменить путь к целевой папке мода")
        print("  5. Выйти")
        print()
        try:
            choice = input("Выберите действие (1-5): ").strip()
        except (KeyboardInterrupt, EOFError):
            break

        if choice == "1":
            print("\n--- Список дубликатов ---")
            total_dup, _ = process_files(target_dir, vanilla_keys, "status")
            print(f"\nВсего найдено дубликатов: {total_dup}")
            input("\nНажмите Enter для продолжения...")
        elif choice == "2":
            print("\n--- Закомментирование дубликатов ---")
            total_dup, modified = process_files(target_dir, vanilla_keys, "comment")
            print(f"\nДействие завершено. Изменено строк: {modified} (из {total_dup} дубликатов)")
            input("\nНажмите Enter для продолжения...")
        elif choice == "3":
            print("\n--- Раскомментирование дубликатов ---")
            total_dup, modified = process_files(target_dir, vanilla_keys, "uncomment")
            print(f"\nДействие завершено. Изменено строк: {modified} (из {total_dup} дубликатов)")
            input("\nНажмите Enter для продолжения...")
        elif choice == "4":
            new_path = input("\nВведите новый путь к папке мода: ").strip()
            if new_path:
                resolved = resolve_target_dir(new_path, lang)
                if os.path.exists(resolved):
                    target_dir = resolved
                    print(f"Путь обновлен: {target_dir}")
                else:
                    print(f"Ошибка: путь не существует ({resolved})")
            input("\nНажмите Enter для продолжения...")
        elif choice == "5":
            break
        else:
            print("Неверный выбор, попробуйте еще раз.")
            import time
            time.sleep(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Factorio Locale Duplicates Manager")
    parser.add_argument("path", nargs="?", default=None, help="Target mod folder or locale folder")
    parser.add_argument("--action", choices=["status", "comment", "uncomment"], default=None, help="Action to execute without menu")
    parser.add_argument("--lang", default="ru", help="Language code (default: ru)")
    parser.add_argument("--factorio-data", default=None, help="Path to Factorio data directory")

    args = parser.parse_args()

    data_dir = args.factorio_data or STEAM_DATA_DIR
    target_lang = args.lang

    print(f"Загрузка ванильных ключей из {data_dir}...")
    vanilla_keys, modules_found = load_vanilla_keys(data_dir, target_lang)

    target_path = DEFAULT_MOD_LOCALE_DIR
    if args.path:
        target_path = resolve_target_dir(args.path, target_lang)

    if args.action:
        if sys.platform == "win32":
            import io
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
        total_dup, modified = process_files(target_path, vanilla_keys, args.action)
        print(f"Действие '{args.action}' выполнено. Найдено дубликатов: {total_dup}, изменено: {modified}")
    else:
        main_menu(target_path, vanilla_keys, modules_found, target_lang)
