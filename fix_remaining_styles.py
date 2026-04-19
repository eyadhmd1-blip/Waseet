"""
Fix remaining module-level StyleSheet.create blocks that use colors.xxx
For each: convert to factory function + inject useMemo into the component.
"""
import re

# (filepath, style_var_name, component_func_name, component_has_colors_already)
FIXES = [
    # contract-detail.tsx
    ('mobile/app/contract-detail.tsx', 'chip', 'InfoChip', False),
    ('mobile/app/contract-detail.tsx', 'dr',   'DetailRow', False),
    ('mobile/app/contract-detail.tsx', 'bc',   'BidCard', False),
    ('mobile/app/contract-detail.tsx', 'vr',   'VisitRow', False),
    # notification-settings.tsx
    ('mobile/app/notification-settings.tsx', 'toggleSt', 'NotifToggle', False),
    ('mobile/app/notification-settings.tsx', 'st', None, True),  # main screen
    # portfolio.tsx
    ('mobile/app/portfolio.tsx', 'baStyles', 'BeforeAfterViewer', False),
    ('mobile/app/portfolio.tsx', 'cardSt',   'PortfolioCard', False),
    ('mobile/app/portfolio.tsx', 'stCard',   'StatCard', False),
    ('mobile/app/portfolio.tsx', 'st',       None, True),  # main screen
    # portfolio-add.tsx
    ('mobile/app/portfolio-add.tsx', 'ubSt', 'UploadBox', False),
    ('mobile/app/portfolio-add.tsx', 'st',   None, True),  # main screen
    # recurring-request.tsx
    ('mobile/app/recurring-request.tsx', 'prog', 'ProgressBar', False),
    # request-detail.tsx
    ('mobile/app/request-detail.tsx', 'bidStyles', 'BidCard', False),
    # subscribe.tsx
    ('mobile/app/subscribe.tsx', 'featureStyles', 'CheckIcon', False),
]

BASE = 'c:/Users/e.hammad/Desktop/Waseet'

def fn_name_for(var):
    return 'create' + var[0].upper() + var[1:]

def find_stylesheet_block(content, var_name):
    """Find const VAR = StyleSheet.create({ ... }); and return (start, end)."""
    pattern = re.compile(r'^const ' + re.escape(var_name) + r' = StyleSheet\.create\(', re.MULTILINE)
    m = pattern.search(content)
    if not m:
        return None, None
    # find opening {
    i = m.end()
    while i < len(content) and content[i] != '{':
        i += 1
    if i >= len(content):
        return None, None
    brace_start = i
    depth = 0
    while i < len(content):
        if content[i] == '{': depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                i += 1
                # skip );
                while i < len(content) and content[i] in (' ', '\n', '\r'): i += 1
                if i < len(content) and content[i] == ')': i += 1
                while i < len(content) and content[i] in (' ', '\n', '\r'): i += 1
                if i < len(content) and content[i] == ';': i += 1
                break
        i += 1
    return m.start(), i

def find_component_body_start(content, comp_name):
    """Find function COMP_NAME(...) { and return pos of {"""
    pat = re.compile(r'^(?:export default )?function ' + re.escape(comp_name) + r'\b', re.MULTILINE)
    m = pat.search(content)
    if not m:
        return None
    i = m.end()
    # skip params
    paren_depth = 0
    while i < len(content):
        if content[i] == '(': paren_depth += 1
        elif content[i] == ')':
            paren_depth -= 1
            if paren_depth == 0: i += 1; break
        i += 1
    # find body {
    while i < len(content) and content[i] != '{':
        i += 1
    return i  # position of {

def find_main_component_body_start(content):
    """Find the export default function ... { """
    pat = re.compile(r'^export default function \w+', re.MULTILINE)
    m = pat.search(content)
    if not m:
        return None
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
    return i

processed_files = {}

for filepath, var_name, comp_name, comp_has_colors in FIXES:
    full_path = f'{BASE}/{filepath}'
    if full_path not in processed_files:
        with open(full_path, 'r', encoding='utf-8') as f:
            processed_files[full_path] = f.read().replace('\r\n', '\n')
    content = processed_files[full_path]

    # 1. Find and convert the StyleSheet.create block
    start, end = find_stylesheet_block(content, var_name)
    if start is None:
        print(f'  NOT FOUND: {var_name} in {filepath}')
        continue

    old_block = content[start:end]
    fn = fn_name_for(var_name)

    # Build new factory function by modifying the old block
    # Replace "const VAR = StyleSheet.create({" with "function createVAR(colors: AppColors) {\n  return StyleSheet.create({"
    new_block = old_block.replace(
        f'const {var_name} = StyleSheet.create({{',
        f'function {fn}(colors: AppColors) {{\n  return StyleSheet.create({{'
    )
    # Replace closing "})" or "});" with "  });\n}"
    # The old block ends with "});" — replace last occurrence
    if new_block.rstrip().endswith('});'):
        new_block = new_block.rstrip()[:-3].rstrip() + '\n  });\n}'
    elif new_block.rstrip().endswith('})'):
        new_block = new_block.rstrip()[:-2].rstrip() + '\n  });\n}'

    content = content[:start] + new_block + content[end:]
    print(f'  converted {var_name} -> {fn} in {filepath}')

    # 2. Inject useMemo into the component
    if comp_name:
        body_start = find_component_body_start(content, comp_name)
    else:
        body_start = find_main_component_body_start(content)

    if body_start is None:
        print(f'  Component body not found for {comp_name or "main"} in {filepath}')
        processed_files[full_path] = content
        continue

    # Check if already injected
    peek = content[body_start+1:body_start+300]
    if f'const {var_name} = useMemo' in peek:
        print(f'  already injected {var_name} in {comp_name or "main"}')
        processed_files[full_path] = content
        continue

    lines_to_inject = []
    if not comp_has_colors:
        # Check if useTheme is already called in the function body
        body_end_search = content[body_start+1:body_start+500]
        if 'const { colors } = useTheme()' not in body_end_search and "const {colors} = useTheme()" not in body_end_search:
            lines_to_inject.append('const { colors } = useTheme();')
    lines_to_inject.append(f'const {var_name} = useMemo(() => {fn}(colors), [colors]);')

    inject_str = '\n' + '\n'.join('  ' + l for l in lines_to_inject)
    content = content[:body_start+1] + inject_str + content[body_start+1:]
    print(f'  injected into {comp_name or "main"}: {lines_to_inject}')

    processed_files[full_path] = content

# Write all modified files
for path, content in processed_files.items():
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  wrote {path}')

print('Done!')
