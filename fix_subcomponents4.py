"""
Final pass: add const { colors } = useTheme() to any component function
that has `createStyles(colors)` or `colors.` but no colors declaration.
"""
import re
import os

def find_body_brace(content, fn_start):
    """Find the opening { of the function body, skipping parameter braces."""
    i = fn_start
    while i < len(content) and content[i] != '(':
        i += 1
    if i >= len(content):
        return -1
    paren_depth = 0
    while i < len(content):
        c = content[i]
        if c == '(':
            paren_depth += 1
        elif c == ')':
            paren_depth -= 1
            if paren_depth == 0:
                i += 1
                break
        i += 1
    while i < len(content):
        if content[i] == '{':
            return i
        if content[i] == '\n' and i > fn_start + 200:
            return -1
        i += 1
    return -1

def get_function_body(content, fn_start):
    body_start = find_body_brace(content, fn_start)
    if body_start == -1:
        return -1, -1
    depth = 0
    i = body_start
    while i < len(content):
        c = content[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return body_start, i
        i += 1
    return -1, -1

def body_uses_colors(body):
    """Check if body uses colors as a variable (colors. or colors) or colors in function calls."""
    return bool(re.search(r'\bcolors\b', body))

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace('\r\n', '\n')

    if 'useTheme' not in content:
        return False, 0

    fn_pat = re.compile(r'^function ([A-Z][A-Za-z0-9_]*)\b', re.MULTILINE)
    matches = list(fn_pat.finditer(content))
    if not matches:
        return False, 0

    fn_bodies = []
    for m in matches:
        body_start, body_end = get_function_body(content, m.start())
        if body_start == -1:
            continue
        body = content[body_start+1:body_end]
        fn_bodies.append((m.group(1), body_start, body_end, body))

    modified = False
    inject_count = 0
    inserted_offset = 0

    for fn_name, orig_body_start, orig_body_end, body in fn_bodies:
        needs_colors = body_uses_colors(body)
        has_colors_decl = 'const { colors }' in body or "const {colors}" in body

        uses_styles = 'styles.' in body
        has_styles_decl = 'const styles ' in body or 'const styles=' in body

        if not needs_colors and not uses_styles:
            continue

        lines_to_inject = []

        # Always add colors declaration if needed by styles or direct use
        if (needs_colors or uses_styles) and not has_colors_decl:
            lines_to_inject.append('const { colors } = useTheme();')
        if uses_styles and not has_styles_decl:
            lines_to_inject.append('const styles = useMemo(() => createStyles(colors), [colors]);')

        if lines_to_inject:
            inject_str = '\n' + '\n'.join('  ' + l for l in lines_to_inject)
            insert_pos = orig_body_start + 1 + inserted_offset
            content = content[:insert_pos] + inject_str + content[insert_pos:]
            inserted_offset += len(inject_str)
            inject_count += 1
            modified = True
            print(f"    + {fn_name}: {lines_to_inject}")

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return modified, inject_count

base = 'c:/Users/e.hammad/Desktop/Waseet/mobile/app'
files = [
    '(auth)/index.tsx',
    '(auth)/onboarding.tsx',
    '(client)/index.tsx',
    '(client)/messages.tsx',
    '(client)/profile.tsx',
    '(client)/requests.tsx',
    '(provider)/dashboard.tsx',
    '(provider)/index.tsx',
    '(provider)/messages.tsx',
    '(provider)/profile.tsx',
    'chat.tsx',
    'contract-detail.tsx',
    'notification-settings.tsx',
    'portfolio-add.tsx',
    'portfolio.tsx',
    'provider-profile.tsx',
    'recurring-request.tsx',
    'request-detail.tsx',
    'subscribe.tsx',
    'urgent-request.tsx',
]

total = 0
for f in files:
    full = os.path.join(base, f)
    modified, count = fix_file(full)
    if modified:
        print(f"  -> {count} in {f}")
        total += count
    else:
        print(f"  skip: {f}")

print(f"\nTotal: {total}")
