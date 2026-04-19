import re
import os

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'COLORS.' not in content:
        return False

    # Determine import path prefix based on directory depth
    norm = filepath.replace('\\', '/')
    app_index = norm.find('/app/')
    after_app = norm[app_index+5:]
    slashes_after_app = after_app.count('/')
    prefix = '../../' if slashes_after_app >= 1 else '../'

    theme_ctx_import = "import { useTheme } from '" + prefix + "src/context/ThemeContext';"
    colors_type_import = "import type { AppColors } from '" + prefix + "src/constants/colors';"

    # 1. Fix theme import - remove COLORS from it
    def fix_theme_import(m):
        inner = m.group(1)
        path = m.group(2)
        items = [x.strip() for x in inner.split(',')]
        items = [x for x in items if x and x != 'COLORS']
        if not items:
            return ''
        return "import { " + ', '.join(items) + " } from '" + path + "';"

    content = re.sub(
        r"import\s+\{([^}]*)\}\s+from\s+'([^']*theme[^']*)'",
        fix_theme_import,
        content
    )
    content = re.sub(r'\n\n\n+', '\n\n', content)

    # 2. Add useTheme import if not present
    if 'useTheme' not in content:
        lines = content.split('\n')
        last_import_idx = -1
        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import_idx = i
        if last_import_idx >= 0:
            lines.insert(last_import_idx + 1, theme_ctx_import)
            content = '\n'.join(lines)

    # 3. Add AppColors type import if not present
    if 'AppColors' not in content:
        lines = content.split('\n')
        last_import_idx = -1
        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import_idx = i
        if last_import_idx >= 0:
            lines.insert(last_import_idx + 1, colors_type_import)
            content = '\n'.join(lines)

    # 4. Add useMemo to React import
    if 'useMemo' not in content:
        content = re.sub(
            r"import React, \{([^}]*)\} from 'react'",
            lambda m: "import React, {" + m.group(1).rstrip() + ", useMemo} from 'react'",
            content
        )
        if 'useMemo' not in content:
            content = re.sub(
                r"import \{([^}]*)\} from 'react'",
                lambda m: "import {" + m.group(1).rstrip() + ", useMemo} from 'react'",
                content
            )

    # 5. Add const { colors } = useTheme() inside main component
    if 'const { colors } = useTheme()' not in content:
        content = re.sub(
            r'(export default function \w+\([^)]*\)\s*\{)',
            lambda m: m.group(0) + '\n  const { colors } = useTheme();',
            content,
            count=1
        )

    # 6. Add styles useMemo inside component and convert StyleSheet to factory fn
    if 'const styles = StyleSheet.create' in content and 'function createStyles' not in content:
        # Add useMemo call inside component after colors hook
        if 'const { colors } = useTheme()' in content and 'const styles = useMemo' not in content:
            content = content.replace(
                'const { colors } = useTheme();',
                'const { colors } = useTheme();\n  const styles = useMemo(() => createStyles(colors), [colors]);',
                1
            )

        # Convert module-level StyleSheet.create to createStyles factory
        content = re.sub(
            r'^const styles = StyleSheet\.create\(',
            'function createStyles(colors: AppColors) {\n  return StyleSheet.create(',
            content,
            flags=re.MULTILINE,
            count=1
        )
        # Fix the closing of StyleSheet.create - find last }); at module level
        lines = content.split('\n')
        for i in range(len(lines)-1, -1, -1):
            stripped = lines[i].strip()
            if stripped == '});':
                lines[i] = '  });'
                lines.insert(i+1, '}')
                break
        content = '\n'.join(lines)

    # 7. Replace all COLORS. with colors.
    content = content.replace('COLORS.', 'colors.')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return True

base = r'c:\Users\e.hammad\Desktop\Waseet\mobile\app'
files = [
    r'(auth)/index.tsx',
    r'(auth)/onboarding.tsx',
    r'(client)/index.tsx',
    r'(client)/messages.tsx',
    r'(client)/profile.tsx',
    r'(client)/requests.tsx',
    r'(provider)/dashboard.tsx',
    r'(provider)/index.tsx',
    r'(provider)/jobs.tsx',
    r'(provider)/messages.tsx',
    r'(provider)/profile.tsx',
    r'chat.tsx',
    r'contract-detail.tsx',
    r'grace-period.tsx',
    r'notification-settings.tsx',
    r'portfolio-add.tsx',
    r'portfolio.tsx',
    r'provider-confirm.tsx',
    r'provider-profile.tsx',
    r'recurring-request.tsx',
    r'request-detail.tsx',
    r'subscribe.tsx',
    r'urgent-request.tsx',
]

done = 0
for f in files:
    full = os.path.join(base, f)
    try:
        if migrate_file(full):
            print("OK " + f)
            done += 1
        else:
            print("SKIP " + f)
    except Exception as e:
        print("ERR " + f + ": " + str(e))

print("\nDone: " + str(done) + "/" + str(len(files)) + " files migrated")
