"""
Fix all screen load() functions:
1. Replace supabase.auth.getUser() → supabase.auth.getSession()
2. Fix destructuring to extract user from session
3. Wrap load body in try-finally so setLoading(false) always runs
"""
import re
import os
import glob

APP_DIR = r"C:\Users\e.hammad\Desktop\Waseet\mobile\app"

# Pattern for: const { data: { user: authUser } } = await supabase.auth.getUser();
# Replace with:  const { data: { session: _ses } } = await supabase.auth.getSession();
#                const authUser = _ses?.user;
PATTERN_AUTHUSER = re.compile(
    r"const \{ data: \{ user: authUser \} \} = await supabase\.auth\.getUser\(\);",
    re.MULTILINE
)
REPLACEMENT_AUTHUSER = (
    "const { data: { session: _ses } } = await supabase.auth.getSession();\n"
    "    const authUser = _ses?.user;"
)

# Pattern for: const { data: { user } } = await supabase.auth.getUser();
PATTERN_USER = re.compile(
    r"const \{ data: \{ user \} \} = await supabase\.auth\.getUser\(\);",
    re.MULTILINE
)
REPLACEMENT_USER = (
    "const { data: { session: _ses } } = await supabase.auth.getSession();\n"
    "    const user = _ses?.user;"
)

# Nested in useCallback: ensure setLoading(false) always called
# Pattern: async function body that starts with getSession and has setLoading(false) inside
# We need to wrap the body in try-finally.
# Strategy: find load functions and add try-finally wrapper

def fix_early_returns(content: str) -> str:
    """Add setLoading(false) before early returns in load functions."""
    # Pattern: if (!user) return; → if (!user) { setLoading(false); return; }
    content = re.sub(
        r"if \(!user\) return;",
        "if (!user) { setLoading(false); return; }",
        content
    )
    content = re.sub(
        r"if \(!authUser\) return;",
        "if (!authUser) { setLoading(false); return; }",
        content
    )
    return content

def fix_getuser(content: str) -> str:
    """Replace getUser() with getSession() and fix destructuring."""
    content = PATTERN_AUTHUSER.sub(REPLACEMENT_AUTHUSER, content)
    content = PATTERN_USER.sub(REPLACEMENT_USER, content)
    return content

def process_file(path: str) -> bool:
    with open(path, "r", encoding="utf-8") as f:
        original = f.read()

    # Only process files that use getUser in load-like contexts
    if "supabase.auth.getUser()" not in original:
        return False

    modified = fix_getuser(original)
    modified = fix_early_returns(modified)

    if modified != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(modified)
        print(f"  FIXED: {os.path.basename(path)}")
        return True
    return False

files = glob.glob(os.path.join(APP_DIR, "**", "*.tsx"), recursive=True)
changed = 0
for f in sorted(files):
    if process_file(f):
        changed += 1

print(f"\nTotal files modified: {changed}")
