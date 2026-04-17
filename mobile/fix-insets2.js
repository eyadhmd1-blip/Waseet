// Phase 2: Fix StyleSheet.create() usages of headerPad
// → replace with HEADER_PAD from src/utils/layout.ts
// Also adds import for HEADER_PAD where needed.
const fs   = require('fs');
const path = require('path');

const files = [
  'app/(auth)/login.tsx',
  'app/(auth)/register.tsx',
  'app/(auth)/verify.tsx',
  'app/(client)/index.tsx',
  'app/(client)/messages.tsx',
  'app/(client)/new-request.tsx',
  'app/(client)/profile.tsx',
  'app/(client)/requests.tsx',
  'app/(client)/saved-providers.tsx',
  'app/(provider)/dashboard.tsx',
  'app/(provider)/index.tsx',
  'app/(provider)/jobs.tsx',
  'app/(provider)/messages.tsx',
  'app/(provider)/profile.tsx',
  'app/chat.tsx',
  'app/contract-detail.tsx',
  'app/notification-settings.tsx',
  'app/portfolio-add.tsx',
  'app/portfolio.tsx',
  'app/provider-profile.tsx',
  'app/rate-job.tsx',
  'app/recurring-request.tsx',
  'app/request-detail.tsx',
  'app/support-new.tsx',
  'app/support-thread.tsx',
  'app/support-tickets.tsx',
  'app/support.tsx',
  'app/urgent-request.tsx',
];

function layoutImportPath(filePath) {
  const depth = filePath.split('/').length - 1;
  return '../'.repeat(depth) + 'src/utils/layout';
}

let count = 0;

files.forEach(relPath => {
  const absPath = path.join(__dirname, relPath);
  if (!fs.existsSync(absPath)) return;

  let src = fs.readFileSync(absPath, 'utf8');

  // Replace headerPad inside StyleSheet.create() with HEADER_PAD.
  // Strategy: find const styles = StyleSheet.create({ ... }) block and replace within it.
  // Since it's hard to parse JSX, we do a simpler targeted replace:
  // ANY occurrence of "paddingTop: headerPad" that is inside a StyleSheet.create block.
  // A reliable heuristic: StyleSheet.create comes after the last closing brace of the default
  // export function. So any "paddingTop: headerPad" after "const styles = StyleSheet.create"
  // needs to be replaced.

  // Find index of first StyleSheet.create
  const ssIdx = src.indexOf('StyleSheet.create');
  if (ssIdx === -1) {
    // No StyleSheet, skip replacement
    count++;
    return;
  }

  // Replace all paddingTop: headerPad that appear AFTER first StyleSheet.create
  const before = src.slice(0, ssIdx);
  let after  = src.slice(ssIdx);

  const hadHeaderPadInSS = after.includes('paddingTop: headerPad');
  if (!hadHeaderPadInSS) {
    count++;
    return;
  }

  after = after.replace(/paddingTop:\s*headerPad/g, 'paddingTop: HEADER_PAD');
  src = before + after;

  // Add HEADER_PAD import if not already present
  if (!src.includes('HEADER_PAD') || !src.includes("from '")) {
    // already replaced above, now add the import
  }

  if (!src.includes("'src/utils/layout'") && !src.includes('HEADER_PAD') === false) {
    const importLine = `import { HEADER_PAD } from '${layoutImportPath(relPath)}';\n`;
    // Insert after last import line
    const lastImportMatch = src.match(/(^import .+;\n)/gm);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      const insertAfter = src.lastIndexOf(lastImport) + lastImport.length;
      // Only add if not already there
      if (!src.includes("from '" + layoutImportPath(relPath) + "'")) {
        src = src.slice(0, insertAfter) + importLine + src.slice(insertAfter);
      }
    }
  } else if (!src.includes("from '" + layoutImportPath(relPath) + "'")) {
    const importLine = `import { HEADER_PAD } from '${layoutImportPath(relPath)}';\n`;
    const lastImportMatch = src.match(/(^import .+;\n)/gm);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      const insertAfter = src.lastIndexOf(lastImport) + lastImport.length;
      src = src.slice(0, insertAfter) + importLine + src.slice(insertAfter);
    }
  }

  fs.writeFileSync(absPath, src, 'utf8');
  console.log(`  ✓ fixed StyleSheet: ${relPath}`);
  count++;
});

console.log(`\nPhase 2 done. ${count} files processed.`);
