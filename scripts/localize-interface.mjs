// Idempotent codemod: localize only reviewed display copy, never stored values/user content.
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { parse as parseTemplate } from '@vue/compiler-dom';
import { messages } from '../src/i18n/messages.js';

const attributes = new Set(['aria-label', 'title', 'placeholder', 'label', 'alt']);
const quote = (s) => JSON.stringify(s).replaceAll('"', '&quot;');
function localize(file) {
  let source = fs.readFileSync(file, 'utf8');
  const template = parseSfc(source).descriptor.template;
  if (!template) return;
  const changes = [];
  const add = (node, text) => changes.push([template.loc.start.offset + node.loc.start.offset, template.loc.start.offset + node.loc.end.offset, text]);
  const localizeExpression = (node) => {
    const original = node.content;
    const replaced = original.replace(/(?<!\$t\()'([^'\n]+)'/g, (match, key) => messages[key] ? `$t(${match})` : match);
    if (original !== replaced) add(node, replaced);
  };
  function visit(node) {
    if (node.type === 2 && messages[node.content.trim()]) {
      const key = node.content.trim();
      add(node, node.content.replace(key, `{{ $t(${JSON.stringify(key)}) }}`));
    }
    if (node.type === 5 && !node.content.content.includes('$t(') && !node.content.content.includes('t(')) localizeExpression(node.content);
    if (node.type === 1) {
      for (const prop of node.props) {
        if (prop.type === 6 && attributes.has(prop.name) && messages[prop.value?.content]) add(prop, `:${prop.name}="$t(${quote(prop.value.content)})"`);
        if (prop.type === 7 && prop.name === 'bind' && attributes.has(prop.arg?.content) && prop.exp && !prop.exp.content.includes('t(')) localizeExpression(prop.exp);
      }
    }
    for (const child of node.children || []) visit(child);
  }
  visit(parseTemplate(template.content));
  for (const [start, end, text] of changes.sort((a,b) => b[0]-a[0])) source = source.slice(0,start)+text+source.slice(end);
  if (changes.length) { fs.writeFileSync(file,source); console.log(`${file}: ${changes.length} display strings`); }
}
function walk(dir) {
  for (const item of fs.readdirSync(dir,{withFileTypes:true})) {
    const file = path.join(dir,item.name);
    if (item.isDirectory() && item.name !== '__tests__') walk(file);
    else if (item.name.endsWith('.vue') && item.name !== 'ShopView.vue') localize(file);
  }
}
walk('src');
