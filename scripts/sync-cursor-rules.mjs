#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';

const RULES_DIR = '.cursor/rules';
const PREFIX = '__legacy_mdc__';

async function findRules(dir) {
  const rules = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.name.startsWith(PREFIX) || entry.name === '__MACOSX') continue;

    if (entry.isDirectory()) {
      rules.push(...(await findRules(path)));
    } else if (entry.name === 'RULE.md') {
      rules.push(path);
    }
  }
  return rules;
}

async function main() {
  const rules = await findRules(RULES_DIR);
  console.log(`Found ${rules.length} rules to sync\n`);

  for (const rulePath of rules) {
    const content = await readFile(rulePath, 'utf-8');
    const relativePath = relative(RULES_DIR, rulePath);
    const flatName = relativePath.replace(/\//g, '__').replace('__RULE.md', '');
    const mdcPath = join(RULES_DIR, `${PREFIX}${flatName}.mdc`);

    const mdcContent = `<!-- AUTO-GENERATED from ${relativePath} - DO NOT EDIT -->\n${content}`;
    await writeFile(mdcPath, mdcContent);
    console.log(`Generated: ${mdcPath}`);
  }

  console.log(`\nDone! Generated ${rules.length} .mdc files`);
}

main().catch(console.error);
