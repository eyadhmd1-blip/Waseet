"""
Fix sub-components that use `colors` or `styles` but don't have useTheme() in scope.
Strategy: parse function bodies, detect usage, inject hooks at the start of each body.
"""
import re
import os

def find_function_ranges(content):
    """Find all top-level function declarations and their {start, end} positions."""
    # Match: function FunctionName( ... ) {
    # or: function FunctionName<T>( ... ) {
    fn_pattern = re.compile(r'^function\s+([A-Z][A-Za-z0-9]*)\s*[<(]', re.MULTILINE)
    results = []
    for m in fn_pattern.finditer(content):
        # Find the opening brace of this function
        brace_start = content.find('{', m.end())
        if brace_start == -1:
            continue
        # Track brace depth to find closing brace
        depth = 0
        i = brace_start
        while i < len(content):
            if content[i] == '{':
                depth += 1
            elif content[i] == '}':
                depth -= 1
                if depth == 0:
                    results.append({
                        'name': m.group(1),
                        'match_start': m.start(),
                        'body_start': brace_start,
                        'body_end': i,
                    })
                    break
            i += 1
    return results

def body_uses(content, fn_range, token):
    body = content[fn_range['body_start']+1:fn_range['body_end']]
    return token in body

def body_declares(content, fn_range, declaration):
    body = content[fn_range['body_start']+1:fn_range['body_end']]
    return declaration in body

def inject_after_open_brace(content, brace_pos, lines_to_inject):
    """Insert lines right after the opening brace of a function body."""
    inject_str = '\n' + '\n'.join('  ' + l for l in lines_to_inject)
    return content[:brace_pos+1] + inject_str + content[brace_pos+1:]

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'useTheme' not in content:
        return False, 0

    modified = False
    inject_count = 0

    # We need to process in reverse order (end to start) to preserve positions
    fn_ranges = find_function_ranges(content)
    fn_ranges.reverse()  # Process from end to start to preserve offsets

    for fn in fn_ranges:
        uses_colors = body_uses(content, fn, 'colors.')
        uses_styles = body_uses(content, fn, 'styles.')
        has_colors_decl = body_declares(content, fn, 'const { colors }')
        has_styles_decl = body_declares(content, fn, 'const styles')

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
            content = inject_after_open_brace(content, fn['body_start'], lines_to_inject)
            inject_count += 1
            modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return modified, inject_count

# Files to fix
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
        print(f"fixed {count} sub-components in {f}")
        total += count
    else:
        print(f"  skip: {f}")

print(f"\nTotal injections: {total}")
