"""
Fix (client)/index.tsx: convert module-level named StyleSheet.create to factory functions.
"""
import re
import os

filepath = 'c:/Users/e.hammad/Desktop/Waseet/mobile/app/(client)/index.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('\r\n', '\n')

# Named styles that need to be converted to factories
named_styles_to_fix = ['qStyles', 'tabStyles', 'ccStyles', 'tbStyles']

# For each named style, convert to factory function
for sname in named_styles_to_fix:
    fn_name = 'create' + sname[0].upper() + sname[1:]

    # Find the module-level declaration
    pattern = re.compile(r'^const ' + sname + r' = StyleSheet\.create\(', re.MULTILINE)
    m = pattern.search(content)
    if not m:
        print(f"  NOT FOUND: {sname}")
        continue

    # Find the StyleSheet.create block
    # After match, find opening (
    i = m.end()  # after 'create('
    # Find the opening {
    while i < len(content) and content[i] != '{':
        i += 1
    if i >= len(content):
        print(f"  No opening brace for {sname}")
        continue

    brace_start = i
    depth = 0
    while i < len(content):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                i += 1  # past }
                # skip ) and ;
                while i < len(content) and content[i] in (' ', '\n'):
                    i += 1
                if i < len(content) and content[i] == ')':
                    i += 1
                while i < len(content) and content[i] in (' ', '\n'):
                    i += 1
                if i < len(content) and content[i] == ';':
                    i += 1
                break
        i += 1

    block_end = i  # position after the full statement
    old_text = content[m.start():block_end]
    inner_block = content[brace_start:block_end]

    # Build factory function
    # inner_block starts with { and ends with }); or };\n
    # Find the inner object content (just the { ... } part)
    obj_end = brace_start
    depth = 0
    j = brace_start
    while j < len(content):
        if content[j] == '{':
            depth += 1
        elif content[j] == '}':
            depth -= 1
            if depth == 0:
                obj_end = j
                break
        j += 1

    inner_obj = content[brace_start:obj_end+1]  # { ... }

    new_fn = f"function {fn_name}(colors: AppColors) {{\n  return StyleSheet.create({inner_obj});\n}}"

    content = content[:m.start()] + new_fn + content[block_end:]
    print(f"  converted: {sname} -> {fn_name}")

# Now add useMemo calls in the sub-components that use each named style
# QuickAccessRow -> qStyles
# GroupTabBar -> tabStyles
# CategoryCard -> ccStyles
# TabCategoryBrowser -> tbStyles

style_to_fn_and_user = {
    'qStyles':   ('createQStyles',   'QuickAccessRow'),
    'tabStyles': ('createTabStyles', 'GroupTabBar'),
    'ccStyles':  ('createCcStyles',  'CategoryCard'),
    'tbStyles':  ('createTbStyles',  'TabCategoryBrowser'),
}

for sname, (fn_name, component_name) in style_to_fn_and_user.items():
    # Find the component function
    fn_pat = re.compile(r'^function ' + component_name + r'\b', re.MULTILINE)
    m = fn_pat.search(content)
    if not m:
        print(f"  Component NOT FOUND: {component_name}")
        continue

    # Find the body opening {
    i = m.end()
    paren_depth = 0
    while i < len(content):
        if content[i] == '(':
            paren_depth += 1
        elif content[i] == ')':
            paren_depth -= 1
            if paren_depth == 0:
                i += 1
                break
        i += 1
    while i < len(content) and content[i] != '{':
        i += 1
    body_start = i

    # Check if already has this useMemo
    body_peek = content[body_start+1:body_start+200]
    if f'const {sname} = useMemo' in content[body_start:body_start+500]:
        print(f"  {component_name}: {sname} useMemo already present")
        continue

    # Check if colors is declared
    body_full_end = body_start
    depth = 0
    i = body_start
    while i < len(content):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                body_full_end = i
                break
        i += 1

    body = content[body_start+1:body_full_end]
    has_colors = 'const { colors }' in body or 'const {colors}' in body

    inject_lines = []
    if not has_colors:
        inject_lines.append('const { colors } = useTheme();')
    inject_lines.append(f'const {sname} = useMemo(() => {fn_name}(colors), [colors]);')

    inject_str = '\n' + '\n'.join('  ' + l for l in inject_lines)
    content = content[:body_start+1] + inject_str + content[body_start+1:]
    print(f"  injected into {component_name}: {inject_lines}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
