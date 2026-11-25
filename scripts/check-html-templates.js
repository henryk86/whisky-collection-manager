/** @fileoverview Enforces external HTML and verifies fragment references. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {listJavaScriptFiles} from './javascript-files.js';
import {parseTemplates} from '../public/js/ui/templates.js';

const tag = /<\/?[A-Za-z][\w:-]*(?=[\s/>]|$)|<!--|<!DOCTYPE/i;
const files = listJavaScriptFiles(process.cwd(), ['public']);
let templateCount = 0;
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const templateFile = path.join(path.dirname(file), 'templates', path.basename(file, '.js') + '.html');
  const templates = fs.existsSync(templateFile) ? parseTemplates(fs.readFileSync(templateFile, 'utf8')) : new Map();
  const used = new Set();
  /**
   * Validates literal markup and named slot bindings in the syntax tree.
   * @param {!ts.Node} node JavaScript syntax node to inspect.
   */
  function visit(node) {
    const parts = ts.isTemplateExpression(node) ?
      [node.head.text, ...node.templateSpans.map(span => span.literal.text)] :
      ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? [node.text] : [];
    const marker = file.endsWith('/ui/dom-renderer.js') &&
      (ts.isStringLiteral(node) && node.text === '<!--' ||
        ts.isTemplateExpression(node) && node.head.text === '<!--wcm-slot-' && node.templateSpans.length === 1 &&
        node.templateSpans[0].literal.text === '-end-->');
    if (!marker && (parts.some(part => tag.test(part)) || ts.isTemplateExpression(node) && parts.some(part => /<\/?$/.test(part)))) {
      const {line} = source.getLineAndCharacterOfPosition(node.getStart());
      throw new Error(`${file}:${line + 1}: HTML belongs in a template`);
    }
    if (!file.endsWith('/ui/dom-renderer.js') && ts.isPropertyAccessExpression(node) &&
      ['innerHTML', 'outerHTML', 'insertAdjacentHTML',
        'createContextualFragment'].includes(node.name.text)) {
      const {line} = source.getLineAndCharacterOfPosition(node.getStart());
      throw new Error(`${file}:${line + 1}: Use native template mounting`);
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'renderTemplate') {
      const [name, bindings] = node.arguments;
      if (!name || !ts.isStringLiteral(name) || !templates.has(name.text)) {
        throw new Error(`${file}: unknown or dynamic template reference`);
      }
      used.add(name.text);
      const slots = new Set([...templates.get(name.text).matchAll(/\{\{(?:raw|text|tag):([\w.]+)\}\}/g)].map(match => match[1]));
      const supplied = new Set(bindings && ts.isObjectLiteralExpression(bindings) ? bindings.properties.map(prop => prop.name?.getText(source)) : []);
      if (slots.size !== supplied.size || [...slots].some(slot => !supplied.has(slot))) {
        throw new Error(`${file}: incorrect bindings for ${name.text}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const name of templates.keys()) {
    if (!used.has(name)) throw new Error(`${templateFile}: unused ${name}`);
  }
  templateCount += templates.size;
}
console.log(`${templateCount} external HTML fragments: references OK.`);
