"""
Convert module-level named StyleSheet.create({...colors...}) to factory functions,
and inject useMemo calls in the components that use them.
"""
import re
import os

def find_body_brace(content, fn_start):
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
        i += 1
    return -1

def get_function_body_bounds(content, fn_start):
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

def get_stylesheet_block(content, const_match_end):
    """Get the full StyleSheet.create({...}) block."""
    # Find the opening ( of create(
    i = const_match_end
    while i < len(content) and content[i] != '(':
        i += 1
    i += 1  # skip (
    # Find the opening {
    while i < len(content) and content[i] != '{':
        i += 1
    brace_start = i
    depth = 0
    while i < len(content):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                i += 1  # skip }
                # Skip the closing )
                while i < len(content) and content[i] in (' ', '\n', '\r'):
                    i += 1
                if i < len(content) and content[i] == ')':
                    i += 1  # skip )
                # Skip optional ;
                while i < len(content) and content[i] in (' ', '\n', '\r'):
                    i += 1
                if i < len(content) and content[i] == ';':
                    i += 1
                return brace_start, i
        i += 1
    return brace_start, i

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace('\r\n', '\n')

    # Find all module-level named StyleSheet.create calls
    named_style_pat = re.compile(
        r'^(const )([a-zA-Z]+[Ss]tyles?) = StyleSheet\.create\(',
        re.MULTILINE
    )

    matches = list(named_style_pat.finditer(content))
    if not matches:
        return False

    # Find which ones use colors
    styles_to_convert = []
    for m in matches:
        # Get the StyleSheet block content
        brace_start, block_end = get_stylesheet_block(content, m.end())
        block = content[brace_start:block_end]
        if 'colors.' in block:
            styles_to_convert.append({
                'name': m.group(2),
                'match_start': m.start(),
                'match_end': m.end(),
                'block_start': brace_start,
                'block_end': block_end,
                'full_start': m.start(),
                'full_end': block_end,
            })

    if not styles_to_convert:
        return False

    # Find all component functions
    fn_pat = re.compile(r'^function ([A-Z][A-Za-z0-9_]*)\b', re.MULTILINE)
    fn_matches = list(fn_pat.finditer(content))

    fn_bodies = []
    for m in fn_matches:
        body_start, body_end = get_function_body_bounds(content, m.start())
        if body_start == -1:
            continue
        fn_bodies.append({
            'name': m.group(1),
            'fn_start': m.start(),
            'body_start': body_start,
            'body_end': body_end,
        })

    # For each named style, find which component uses it
    style_users = {}  # style_name -> list of fn_body dicts
    for st in styles_to_convert:
        sname = st['name']
        users = []
        for fn in fn_bodies:
            body = content[fn['body_start']+1:fn['body_end']]
            if f'{sname}.' in body:
                users.append(fn)
        style_users[sname] = users

    # Process in reverse order to preserve positions
    # Step 1: Collect all edits
    edits = []  # (position, old_text, new_text)

    # Step 1a: Convert module-level named styles to factory functions
    for st in styles_to_convert:
        sname = st['name']
        fn_name = 'create' + sname[0].upper() + sname[1:]

        # Get the full current text of the named style declaration
        old_text = content[st['full_start']:st['full_end']]
        inner = content[st['block_start']:st['block_end']]

        # Build new factory function
        new_text = f"function {fn_name}(colors: AppColors) {{\n  return StyleSheet.create({inner[0]}"
        # inner starts with { and we need to add the inner content
        inner_content = inner  # full block including {}
        new_text = f"function {fn_name}(colors: AppColors) {{\n  return StyleSheet.create({inner_content};\n}}"

        edits.append((st['full_start'], old_text, new_text))

    # Step 1b: Add useMemo calls in using components
    for st in styles_to_convert:
        sname = st['name']
        fn_name = 'create' + sname[0].upper() + sname[1:]
        for fn in style_users.get(sname, []):
            body = content[fn['body_start']+1:fn['body_end']]
            # Check if it already has this useMemo
            if f'const {sname} = useMemo' in body:
                continue
            # Check if colors is available
            has_colors = 'const { colors }' in body or "const {colors}" in body
            if not has_colors:
                continue  # Should have been fixed by previous script
            # Inject after const { colors } = useTheme();
            inject_line = f'\n  const {sname} = useMemo(() => {fn_name}(colors), [colors]);'
            # Find position of colors declaration in full content
            colors_decl = 'const { colors } = useTheme();'
            body_offset = fn['body_start'] + 1
            colors_pos = content.find(colors_decl, body_offset)
            if colors_pos == -1 or colors_pos > fn['body_end']:
                continue
            # Insert after the useTheme line
            after_pos = colors_pos + len(colors_decl)
            edits.append((after_pos, '', inject_line))

    if not edits:
        return False

    # Apply edits in reverse order by position
    edits.sort(key=lambda x: x[0], reverse=True)
    for pos, old, new in edits:
        if old:
            # Replace old with new
            if content[pos:pos+len(old)] == old:
                content = content[:pos] + new + content[pos+len(old):]
        else:
            # Insert at pos
            content = content[:pos] + new + content[pos:]

    # Also add AppColors import if needed
    if 'AppColors' not in content and styles_to_convert:
        # Determine path prefix
        norm = filepath.replace('\\', '/')
        app_index = norm.find('/app/')
        after_app = norm[app_index+5:]
        prefix = '../../' if after_app.count('/') >= 1 else '../'
        colors_import = f"import type {{ AppColors }} from '{prefix}src/constants/colors';"
        lines = content.split('\n')
        last_import = -1
        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import = i
        if last_import >= 0:
            lines.insert(last_import + 1, colors_import)
            content = '\n'.join(lines)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return True

base = 'c:/Users/e.hammad/Desktop/Waseet/mobile/app'
files = [
    '(client)/index.tsx',
    '(client)/profile.tsx',
    '(provider)/dashboard.tsx',
    '(provider)/index.tsx',
    '(provider)/profile.tsx',
    'chat.tsx',
    'portfolio.tsx',
    'recurring-request.tsx',
    'request-detail.tsx',
    'subscribe.tsx',
]

for f in files:
    full = os.path.join(base, f)
    if fix_file(full):
        print(f"fixed: {f}")
    else:
        print(f"skip: {f}")
