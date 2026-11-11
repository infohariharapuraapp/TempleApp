
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'src', 'app');
const APPLY = process.argv.includes('--apply');

const SKIP_FILES = new Set([
  '_layout.tsx',
  'language-settings.tsx',
]);

const SACRED_TEXT = /[ॐಓಂఓం]|(?:mantra|slokam|shloka|sanskrit|verse)/i;

let scanned = 0;
let changed = 0;
let replacements = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, {
    withFileTypes: true,
  }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(full);
    }

    return entry.name.endsWith('.tsx')
      ? [full]
      : [];
  });
}

function migrate(file) {
  scanned++;

  if (SKIP_FILES.has(path.basename(file))) {
    return;
  }

  const source = fs.readFileSync(file, 'utf8');

  if (!source.includes('<Text')) {
    return;
  }

  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  // Only convert files importing Text directly
  // from react-native.
  const hasNativeText = ast.statements.some(
    (statement) => {
      if (!ts.isImportDeclaration(statement)) {
        return false;
      }

      if (
        statement.moduleSpecifier.text !==
        'react-native'
      ) {
        return false;
      }

      const bindings =
        statement.importClause?.namedBindings;

      return (
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.some(
          (element) =>
            element.name.text === 'Text' &&
            !element.propertyName
        )
      );
    }
  );

  if (!hasNativeText) {
    return;
  }

  const edits = [];

  function visit(node) {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(ast) ===
        'Text' &&
      node.closingElement.tagName.getText(ast) ===
        'Text'
    ) {
      const children = node.children;

      // Only plain, static text.
      // Never modify dynamic expressions,
      // nested components or existing t() calls.
      if (
        children.length === 1 &&
        ts.isJsxText(children[0])
      ) {
        const content = children[0].getText(ast);
        const value = content.trim();

        if (
          value.length >= 2 &&
          value.length <= 150 &&
          /[a-zA-Z]/.test(value) &&
          !SACRED_TEXT.test(value) &&
          !/^[\d\s.,:;!?/-]+$/.test(value)
        ) {
          edits.push({
            start:
              node.openingElement.tagName.getStart(ast),
            end:
              node.openingElement.tagName.getEnd(),
            replacement: 'AutoTranslatedText',
          });

          edits.push({
            start:
              node.closingElement.tagName.getStart(ast),
            end:
              node.closingElement.tagName.getEnd(),
            replacement: 'AutoTranslatedText',
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(ast);

  if (!edits.length) {
    return;
  }

  let output = source;

  // Apply edits from end to start so offsets
  // remain valid.
  edits.sort((a, b) => b.start - a.start);

  for (const edit of edits) {
    output =
      output.slice(0, edit.start) +
      edit.replacement +
      output.slice(edit.end);
  }

  if (
    !source.includes(
      "from '@/components/AutoTranslatedText'"
    )
  ) {
    output =
      "import AutoTranslatedText from " +
      "'@/components/AutoTranslatedText';\n" +
      output;
  }

  const count = edits.length / 2;

  changed++;
  replacements += count;

  console.log(
    `${path.relative(ROOT, file)}: ${count} labels`
  );

  if (APPLY) {
    fs.writeFileSync(file + '.bak', source);
    fs.writeFileSync(file, output);
  }
}

for (const file of walk(APP_DIR)) {
  migrate(file);
}

console.log('\nTranslation migration summary');
console.log('Files scanned:', scanned);
console.log('Files affected:', changed);
console.log('Labels identified:', replacements);
console.log(
  APPLY
    ? 'Changes applied. Original files backed up.'
    : 'Preview only. No files changed.'
);
