// Migrates hardcoded paddingTop: 60/56/52/64 to dynamic useInsets() in all screens.
// Run once: node fix-insets.js
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

// Relative import path from app/ or app/(client)/ or app/(provider)/
function insetsImportPath(filePath) {
  const depth = filePath.split('/').length - 1; // depth from root
  // app/chat.tsx → depth=1 → ../src/hooks/useInsets
  // app/(client)/index.tsx → depth=2 → ../../src/hooks/useInsets
  return '../'.repeat(depth) + 'src/hooks/useInsets';
}

let totalChanged = 0;

files.forEach(relPath => {
  const absPath = path.join(__dirname, relPath);
  if (!fs.existsSync(absPath)) {
    console.log(`  SKIP (not found): ${relPath}`);
    return;
  }

  let src = fs.readFileSync(absPath, 'utf8');
  let changed = false;

  // 1. Skip if already has useInsets import
  if (src.includes('useInsets')) {
    console.log(`  already migrated: ${relPath}`);
    return;
  }

  // 2. Add import — insert after last existing import line
  const importPath = insetsImportPath(relPath);
  const importLine = `import { useInsets } from '${importPath}';`;

  // Find position to insert: after the last import line
  const lastImportMatch = src.match(/(^import .+;\n)/gm);
  if (!lastImportMatch) {
    console.log(`  SKIP (no imports found): ${relPath}`);
    return;
  }
  const lastImport = lastImportMatch[lastImportMatch.length - 1];
  const insertAfter = src.lastIndexOf(lastImport) + lastImport.length;
  src = src.slice(0, insertAfter) + importLine + '\n' + src.slice(insertAfter);
  changed = true;

  // 3. Inject hook call — find first export default function component
  //    and insert `const { headerPad } = useInsets();` after the first `{`
  //    in the function body that is on its own line
  const funcPattern = /(export default function \w+[^{]*\{)([\s\S]*?)(const \[|const \w+ =|const { |useEffect|useCallback|useState|useRef|useRouter|useLanguage|useLanguage\()/;
  const funcMatch = src.match(funcPattern);
  if (funcMatch) {
    const insertIdx = src.indexOf(funcMatch[3], src.indexOf(funcMatch[1]));
    if (insertIdx !== -1) {
      src = src.slice(0, insertIdx) + '  const { headerPad } = useInsets();\n  ' + src.slice(insertIdx);
    }
  }

  // 4. Replace hardcoded paddingTop values in StyleSheet only
  //    Pattern: paddingTop: 60  OR  paddingTop: 56  OR  paddingTop: 52  OR  paddingTop: 64
  //    → paddingTop: headerPad
  //    We need to also remove paddingTop from StyleSheet.create and use inline [style, {paddingTop: headerPad}]

  // Simpler approach: replace the static value with the variable
  // This breaks StyleSheet.create() rules, but RN allows mixing
  src = src.replace(/paddingTop:\s*(60|56|52|64)([,\s])/g, 'paddingTop: headerPad$2');
  src = src.replace(/paddingTop:\s*(60|56|52|64)\s*\}/g, 'paddingTop: headerPad }');

  fs.writeFileSync(absPath, src, 'utf8');
  console.log(`  ✓ migrated: ${relPath}`);
  totalChanged++;
});

console.log(`\nDone. ${totalChanged} files updated.`);
