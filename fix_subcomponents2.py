"""
Fix sub-components: inject useTheme() + createStyles into every capital-letter
function that uses colors/styles but doesn't declare them.
Handles CRLF and multi-line function signatures.
"""
import re
import os

def get_function_body(content, fn_line_start):
    """Given the position where a 'function X(' line starts, find the body {..}."""
    # Find the opening { of the function body
    i = fn_line_start
    depth = 0
    body_start = -1
    body_end = -1
    while i < len(content):
        c = content[i]
        if c == '{' and body_start == -1:
            body_start = i
            depth = 1
        elif c == '{' and body_start != -1:
            depth += 1
        elif c == '}' and body_start != -1:
            depth -= 1
            if depth == 0:
                body_end = i
                break
        i += 1
    return body_start, body_end

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    # Normalize line endings to LF for processing
    content = content.replace('\r\n', '\n')

    if 'useTheme' not in content:
        return False, 0

    # Find all top-level function declarations with capital letter names
    # Pattern: starts at beginning of line
    fn_pat = re.compile(r'^function ([A-Z][A-Za-z0-9_]*)\b', re.MULTILINE)

    matches = list(fn_pat.finditer(content))
    if not matches:
        return False, 0

    modified = False
    inject_count = 0
    offset = 0  # Track offset as we insert text

    # Process in forward order but track offset
    for m in matches:
        fn_name = m.group(1)
        fn_start = m.start() + offset

        # Get the function body
        body_start, body_end = get_function_body(content, fn_start)
        if body_start == -1:
            continue

        body = content[body_start+1:body_end]

        # Check what the body uses and what it declares
        uses_colors = 'colors.' in body
        uses_styles = 'styles.' in body
        has_colors_decl = 'const { colors }' in body or "const {colors}" in body
        has_styles_decl = 'const styles ' in body or 'const styles=' in body

        if not uses_colors and not uses_styles:
            continue
        if has_colors_decl and (has_styles_decl or not uses_styles):
            continue

        lines_to_inject = []
        if uses_colors and not has_colors_decl:
            lines_to_inject.append('const { colors } = useTheme();')
        if uses_styles and not has_styles_decl:
            lines_to_inject.append('const styles = useMemo(() => createStyles(colors), [colors]);')

        if lines_to_inject:
            inject_str = '\n' + '\n'.join('  ' + l for l in lines_to_inject)
            # Insert right after the opening brace
            insert_pos = body_start + 1
            content = content[:insert_pos] + inject_str + content[insert_pos:]
            offset += len(inject_str)
            inject_count += 1
            modified = True
            print(f"  + {fn_name}: {', '.join(lines_to_inject)}")

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
        print(f"  -> {count} injections in {f}")
        total += count
    else:
        print(f"  skip: {f}")

print(f"\nTotal: {total}")
