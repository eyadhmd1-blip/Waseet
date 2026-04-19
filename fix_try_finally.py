"""
Wrap load/fetch async functions in try-finally so setLoading(false)
always runs even when DB queries throw or hang.

Strategy: for each useCallback async function that contains
setLoading(false), wrap the body in try {} finally { setLoading(false); }
and remove the inline setLoading(false) calls inside the body.

We detect the pattern by finding:
  const load = useCallback(async () => {
    ...
    setLoading(false);
    ...
  }, [...]);

And transform to:
  const load = useCallback(async () => {
    try {
      ...
    } finally {
      setLoading(false);
    }
  }, [...]);
"""

import re
import os
import glob

APP_DIR = r"C:\Users\e.hammad\Desktop\Waseet\mobile\app"

def find_callback_bounds(content: str, start: int) -> tuple[int, int]:
    """
    Given the position of 'async () => {' opening brace,
    find the matching closing brace of the useCallback body.
    Returns (open_brace_pos, close_brace_pos).
    """
    # Find the opening brace
    brace_pos = content.find('{', start)
    if brace_pos == -1:
        return -1, -1

    depth = 0
    i = brace_pos
    while i < len(content):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                return brace_pos, i
        i += 1
    return brace_pos, -1

def wrap_with_try_finally(body: str, indent: str) -> str:
    """
    Takes the function body content (between braces) and wraps it in try-finally.
    Removes inline setLoading(false) calls and puts one in finally.
    """
    # Strip leading/trailing whitespace but preserve internal structure
    stripped = body.strip('\n')

    # Remove standalone setLoading(false); lines (not part of other expressions)
    # Match: optional spaces + setLoading(false); + newline
    cleaned = re.sub(r'\n    setLoading\(false\);', '', stripped)
    cleaned = re.sub(r'\n  setLoading\(false\);', '', cleaned)

    # Also handle setRefreshing patterns - leave those alone
    # Build the try-finally wrapped version
    # We need to re-indent the body content by 2 extra spaces (for the try block)
    lines = cleaned.split('\n')
    indented_lines = []
    for line in lines:
        if line.strip():
            indented_lines.append('  ' + line)
        else:
            indented_lines.append(line)

    wrapped_body = '\n'.join(indented_lines)

    result = f"\n    try {{\n{wrapped_body}\n    }} finally {{\n      setLoading(false);\n    }}\n  "
    return result

def process_file(path: str) -> bool:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Only process files that have both useCallback async and setLoading
    if 'useCallback(async' not in content or 'setLoading(false)' not in content:
        return False

    # Skip files that already have try { in a load/fetch callback
    # (to avoid double-wrapping)
    # We'll check each callback individually

    # Find all useCallback async patterns
    pattern = re.compile(r'const (?:load|fetch\w*|loadData|loadProfile|loadProvider|loadRequests|loadMessages|loadJobs) = useCallback\(async \(\) => \{')

    modified = content
    offset = 0

    for match in pattern.finditer(content):
        # Find the position in the current modified string
        # (We process sequentially, so we need to track offset)
        match_start = match.start() + offset

        # Find the opening { of the async arrow function
        open_pos = modified.find('{', match_start + (match.end() - match.start()) - 1)
        if open_pos == -1:
            continue

        # Find matching closing brace
        _, close_pos = find_callback_bounds(modified, open_pos)
        if close_pos == -1:
            continue

        # Extract the body (between braces, exclusive)
        body = modified[open_pos+1:close_pos]

        # Skip if already has try-finally
        if 'try {' in body and 'finally {' in body:
            continue

        # Skip if no setLoading(false) in this body
        if 'setLoading(false)' not in body:
            continue

        # Wrap the body
        new_body = wrap_with_try_finally(body, '    ')

        # Replace in modified string
        new_content = modified[:open_pos+1] + new_body + modified[close_pos:]
        offset += len(new_content) - len(modified)
        modified = new_content

    if modified != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(modified)
        print(f"  WRAPPED: {os.path.basename(path)}")
        return True

    return False

files = glob.glob(os.path.join(APP_DIR, '**', '*.tsx'), recursive=True)
changed = 0
for f in sorted(files):
    if process_file(f):
        changed += 1

print(f"\nTotal files modified: {changed}")
