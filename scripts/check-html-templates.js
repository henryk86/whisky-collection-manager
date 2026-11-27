/** @fileoverview Enforces external HTML and verifies fragment references. */
import fs from 'node:fs';
import path from 'node:path';
import {parseJavaScript, forEachChild} from './javascript-ast.js';
import {listJavaScriptFiles} from './javascript-files.js';
import {parseTemplates, resolveTemplateURL} from '../public/js/ui/templates.js';
import {fileURLToPath} from 'node:url';
import {listTemplateFiles} from './template-files.js';
import {validateTemplateStructure} from './html-template-structure.js';

const tag = /<\/?[A-Za-z][\w:-]*(?=[\s/>]|$)|<!--|<!DOCTYPE/i;
const files = listJavaScriptFiles(process.cwd(), ['public']);
const templateFiles = new Set(listTemplateFiles());
const referencedFiles = new Map();
let templateCount = 0;
for (const filename of files) {
  const file = filename.split(path.sep).join('/');
  const source = fs.readFileSync(file, 'utf8');
  const {program} = parseJavaScript(file, source);
  let templateFile;
  /**
   * Resolves the actual static template loader call before checking fragments.
   * @param {*} node JavaScript syntax node to inspect.
   */
  function findTemplate(node) {
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'loadTemplates') {
      const [name] = node.arguments;
      if (templateFile || node.arguments.length !== 1 || !name || !(name.type === 'Literal' && typeof name.value === 'string')) {
        throw new Error(`${file}: expected one static central template path`);
      }
      templateFile = path.relative(process.cwd(), fileURLToPath(resolveTemplateURL(name.value))).split(path.sep).join('/');
      if (!templateFiles.has(templateFile)) throw new Error(`${file}: missing template ${templateFile}`);
      if (!referencedFiles.has(templateFile)) {
        referencedFiles.set(templateFile, {
          templates: parseTemplates(fs.readFileSync(templateFile, 'utf8')),
          used: new Set(),
        });
      }
    }
    forEachChild(node, findTemplate);
  }
  findTemplate(program);
  const {templates, used} = referencedFiles.get(templateFile) || {templates: new Map(), used: new Set()};
  /**
   * Validates literal markup and named slot bindings in the syntax tree.
   * @param {*} node JavaScript syntax node to inspect.
   */
  function visit(node) {
    const template = node.type === 'TemplateLiteral';
    const literal = node.type === 'Literal' && typeof node.value === 'string';
    const parts = template ? node.quasis.map(part => part.value.cooked ?? part.value.raw) : literal ? [node.value] : [];
    const marker = file.endsWith('/ui/dom-renderer.js') &&
      (literal && node.value === '<!--' || template && parts[0] === '<!--wcm-slot-' && parts.length === 2 && parts[1] === '-end-->');
    if (!marker && (parts.some(part => tag.test(part)) || template && node.expressions.length > 0 && parts.some(part => /<\/?$/.test(part)))) {
      const {line} = node.loc.start;
      throw new Error(`${file}:${line}: HTML belongs in a template`);
    }
    if (!file.endsWith('/ui/dom-renderer.js') && node.type === 'MemberExpression' &&
      ['innerHTML', 'outerHTML', 'insertAdjacentHTML',
        'createContextualFragment'].includes((node.computed ? node.property.value : node.property.name))) {
      const {line} = node.loc.start;
      throw new Error(`${file}:${line}: Use native template mounting`);
    }
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'renderTemplate') {
      const [name, bindings] = node.arguments;
      if (!name || !(name.type === 'Literal' && typeof name.value === 'string') || !templates.has(name.value)) {
        throw new Error(`${file}: unknown or dynamic template reference`);
      }
      used.add(name.value);
      const slots = new Set([...templates.get(name.value).matchAll(/\{\{(?:content|attr|attrs|text|tag):([\w.]+)\}\}/g)].map(match => match[1]));
      const properties = bindings && bindings.type === 'ObjectExpression' ? bindings.properties : [];
      const supplied = new Set(properties.map(prop => prop.key && source.slice(prop.key.start, prop.key.end)));
      if (supplied.size !== properties.length || slots.size !== supplied.size || [...slots].some(slot => !supplied.has(slot))) {
        throw new Error(`${file}: incorrect bindings for ${name.value}`);
      }
    }
    forEachChild(node, visit);
  }
  visit(program);
}
for (const file of templateFiles) {
  const reference = referencedFiles.get(file);
  if (!reference) throw new Error(`${file}: unreferenced template file`);
  for (const [name, markup] of reference.templates) {
    validateTemplateStructure(markup, `${file}#${name}`);
    const names = new Set([...markup.matchAll(/\{\{(?:content|attr|attrs|text|tag):([\w.]+)\}\}/g)].map(match => match[1]));
    for (const slot of names) {
      const numbered = slot.match(/^(.{2,}?)[2-9]\d*$/);
      if ((numbered && names.has(numbered[1])) || /^[a-z][A-Z]{3,}$/.test(slot)) {
        throw new Error(`${file}#${name}: give ${slot} a descriptive binding name`);
      }
    }
    if (!reference.used.has(name)) throw new Error(`${file}: unused ${name}`);
  }
  templateCount += reference.templates.size;
}
console.log(`${templateCount} external HTML fragments in ${templateFiles.size} central files: references OK.`);
