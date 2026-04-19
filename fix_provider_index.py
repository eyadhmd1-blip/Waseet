"""
Restore the broken section of (provider)/index.tsx.
Replace everything from the broken createDemoBidStyles to end of file
with the correct content from git (with proper factory function structure).
"""
import subprocess
import os

filepath = 'c:/Users/e.hammad/Desktop/Waseet/mobile/app/(provider)/index.tsx'

# Get original file from git
result = subprocess.run(
    ['git', 'show', 'HEAD:mobile/app/(provider)/index.tsx'],
    capture_output=True, text=True, encoding='utf-8', errors='replace',
    cwd='c:/Users/e.hammad/Desktop/Waseet'
)
original = result.stdout

# Get original content from line 1483 to end (demoBidStyles + styles + cBidStyles)
original_lines = original.split('\n')
# Line 1483 in 1-indexed = index 1482
suffix_orig = '\n'.join(original_lines[1482:])  # from demoBidStyles onwards

# The suffix_orig starts with:
# const demoBidStyles = StyleSheet.create({
# ...
# });
#
# // ─── Styles ──────────────
#
# const styles = StyleSheet.create({
# ...
# });
#
# // ── Contract bid modal styles
# const cBidStyles = StyleSheet.create({
# ...
# });

# Convert COLORS. to colors. in the styles block, but NOT in cBidStyles
# Find the boundary between 'styles' block and 'cBidStyles' block
cBidStyles_marker = '// ── Contract bid modal styles'
cBidStyles_pos = suffix_orig.find(cBidStyles_marker)

if cBidStyles_pos == -1:
    print("ERROR: could not find cBidStyles marker")
    exit(1)

# Part 1: demoBidStyles + styles (replace COLORS. with colors.)
part1 = suffix_orig[:cBidStyles_pos]
# Part 2: cBidStyles (keep COLORS. as is)
part2 = suffix_orig[cBidStyles_pos:]

# Convert part1: COLORS. -> colors. but ONLY in the styles section, not demoBidStyles
# demoBidStyles doesn't use COLORS. anyway, so safe to replace all
part1_converted = part1.replace('COLORS.', 'colors.')

# Now wrap correctly:
# 1. demoBidStyles: stays as factory function (but without colors param since it doesn't use it)
# 2. styles: convert to createStyles factory

# Replace 'const demoBidStyles = StyleSheet.create(' with proper factory
part1_converted = part1_converted.replace(
    'const demoBidStyles = StyleSheet.create({',
    'function createDemoBidStyles(_colors: AppColors) {\n  return StyleSheet.create({'
)
# Fix the closing of demoBidStyles
# The original demoBidStyles ends with '});\n\n// ─── Styles'
part1_converted = part1_converted.replace(
    '});\n\n// ─── Styles',
    '  });\n}\n\n// ─── Styles'
)

# Replace 'const styles = StyleSheet.create(' with createStyles factory
part1_converted = part1_converted.replace(
    'const styles = StyleSheet.create({',
    'function createStyles(colors: AppColors) {\n  return StyleSheet.create({'
)
# Fix closing of styles block: the original ends with '})\n;'
# In the part1, styles ends right before cBidStyles_marker
# Find the last '})\n;' or '});\n'
# The last line of part1 should end the styles block
# Replace the last '})\n;' with proper closing
# Actually, let's just replace the tail of part1
if part1_converted.rstrip().endswith('});'):
    part1_converted = part1_converted.rstrip()[:-3] + '  });\n}'

# For cBidStyles: convert to use COLORS. (already uses COLORS. from original)
# But the current file has colors. (from the previous migration)
# So we keep part2 as-is from git (uses COLORS.)
# But COLORS is still exported for backward compat, so this is fine

# Add closing for cBidStyles function
# In original, cBidStyles ends with '});'
# We need to keep it as module-level const (not factory) since it uses mostly CONTRACT_* colors
# The only colors it uses: colors.textMuted, totalLabel
# Let's convert it to factory too for completeness

# For simplicity, replace colors. with COLORS. in cBidStyles since it's module-level
part2_clean = part2.replace('colors.', 'COLORS.')
# Remove any stray extra braces/semicolons at end

# Combine
new_suffix = part1_converted + '\n' + part2_clean

# Now read current file and replace from the broken section
with open(filepath, 'r', encoding='utf-8') as f:
    current = f.read()
current = current.replace('\r\n', '\n')

# Find where the broken section starts
# It starts with 'function createDemoBidStyles'
marker = '\nfunction createDemoBidStyles'
pos = current.find(marker)
if pos == -1:
    print("ERROR: could not find createDemoBidStyles in current file")
    exit(1)

# Replace from that point to end of file
new_content = current[:pos] + '\n' + new_suffix.rstrip() + '\n'

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done! Fixed provider/index.tsx")
print(f"Original length: {len(current)} chars")
print(f"New length: {len(new_content)} chars")
