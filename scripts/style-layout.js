/**
 * @fileoverview Syntax-aware whitespace changes for the Google JS line layout.
 *
 * Only existing token boundaries are split. String/template contents, regular
 * expressions and identifiers are never rewritten or split.
 */
import ts from 'typescript';

/**
 * Returns the zero-based offset of the start of the current line.
 * @param {string} text JavaScript source.
 * @param {number} offset Source offset.
 * @return {number} Start of the containing line.
 */
function lineStart(text, offset) {
  return text.lastIndexOf('\n', offset - 1) + 1;
}

/**
 * Returns the length of a line containing a source position.
 * @param {string} text JavaScript source.
 * @param {number} offset Source offset.
 * @return {number} Line length before the newline.
 */
function lineLength(text, offset) {
  const end = text.indexOf('\n', offset);
  return (end < 0 ? text.length : end) - lineStart(text, offset);
}

/**
 * Returns the indentation of the line where a construct begins.
 * @param {string} text JavaScript source.
 * @param {number} offset Source offset.
 * @return {number} Number of leading spaces.
 */
function indentation(text, offset) {
  return /^ */.exec(text.slice(lineStart(text, offset)))[0].length;
}

/**
 * Collects safe line-break edits at separators in long expressions.
 * @param {string} filename Source file name for parser context.
 * @param {string} text Original JavaScript source.
 * @param {number=} limit Maximum preferred line length.
 * @return {string} Source with readability-preserving structural line breaks.
 */
export function wrapLongStructures(filename, text, limit = 80) {
  const file = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.JS);
  const edits = [];
  const occupied = new Set();

  function insert(offset, replacement) {
    if (occupied.has(offset)) return;
    occupied.add(offset);
    edits.push({offset, replacement});
  }

  function wrapList(node, elements, open, close, extraIndent) {
    if (elements.length < 2) return;
    const start = node.getStart(file);
    const opening = text.indexOf(open, start);
    const closing = node.end - 1;
    if (opening < 0 || closing <= opening || text[closing] !== close) return;
    // The code already has suitable line breaks if no separator joins items
    // on an overlong line. Preserve intentional multi-line source layout.
    let needsWrap = false;
    for (let i = 0; i + 1 < elements.length; i++) {
      const first = elements[i];
      const second = elements[i + 1];
      if (lineStart(
        text,
        first.end
      ) === lineStart(
        text,
        second.getStart(file)
      ) &&
        lineLength(text, first.end) > limit) {
        needsWrap = true;
        break;
      }
    }
    if (!needsWrap && lineLength(text, opening) > limit &&
      lineStart(
        text,
        opening
      ) === lineStart(
        text,
        elements[0].getStart(file)
      )) {
      needsWrap = true;
    }
    if (!needsWrap) return;
    // A short nested call should stay inline when the enclosing expression
    // needs wrapping. Otherwise every inner call in a long line explodes.
    const expression = text.slice(start, node.end);
    const available = limit - indentation(text, start) - extraIndent;
    if (expression.length < available && !expression.includes('\n')) return;
    const base = indentation(text, start);
    const continuation = ' '.repeat(base + extraIndent);
    const closeIndent = ' '.repeat(base);
    if (lineStart(
      text,
      opening
    ) === lineStart(
      text,
      elements[0].getStart(file)
    )) {
      const space = text.slice(opening + 1, elements[0].getStart(file));
      if (/^\s*$/.test(space)) {
        insert(opening + 1, `\n${continuation}`);
      }
    }
    for (let i = 0; i + 1 < elements.length; i++) {
      const left = elements[i];
      const right = elements[i + 1];
      if (lineStart(text, left.end) !== lineStart(text, right.getStart(file))) {
        continue;
      }
      const gap = text.slice(left.end, right.getStart(file));
      const comma = gap.indexOf(',');
      if (comma < 0 || !/^\s*$/.test(gap.slice(comma + 1))) continue;
      insert(left.end + comma + 1, `\n${continuation}`);
    }
    const last = elements.at(-1);
    if (lineStart(text, last.end) === lineStart(text, closing)) {
      const after = text.slice(last.end, closing);
      if (/^\s*,?\s*$/.test(after)) insert(closing, `\n${closeIndent}`);
    }
  }

  function visit(node) {
    // Visit children before parents; offsets are always from original source.
    ts.forEachChild(node, visit);
    if (ts.isObjectLiteralExpression(node)) {
      wrapList(node, [...node.properties], '{', '}', 2);
    } else if (ts.isArrayLiteralExpression(node)) {
      wrapList(node, [...node.elements], '[', ']', 2);
    } else if (ts.isObjectBindingPattern(node)) {
      wrapList(node, [...node.elements], '{', '}', 2);
    } else if (ts.isArrayBindingPattern(node)) {
      wrapList(node, [...node.elements], '[', ']', 2);
    } else if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      wrapList(node, [...(node.arguments ?? [])], '(', ')', 4);
    } else if (ts.isFunctionDeclaration(node) || ts
      .isFunctionExpression(node) ||
      ts.isArrowFunction(node) || ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node)) {
      // Function declarations may carry multiple parentheses in their types;
      // use the parameter list only if the opening delimiter matches.
      const params = [...node.parameters];
      if (params.length < 2) return;
      const openPosition = text.lastIndexOf('(', params[0].getStart(file));
      const closePosition = text.indexOf(')', params.at(-1).end);
      if (openPosition < node.getStart(file) || closePosition < 0) return;
      const fake = {getStart: () => openPosition, end: closePosition + 1};
      wrapList(fake, params, '(', ')', 4);
    }
  }
  visit(file);
  for (const {offset, replacement} of edits.sort((
    a,
    b
  ) => b.offset - a.offset)) {
    // Never introduce a newline where one already exists at the insertion site.
    text = text.slice(
      0,
      offset
    ) + replacement + text.slice(offset).replace(/^ */,
      ''
    );
  }
  return text;
}

/**
 * Inserts a blank line between adjacent top-level functions, arrow-function
 * declarations and class methods, keeping the next function's JSDoc attached.
 * @param {string} filename Source file name for parser context.
 * @param {string} text JavaScript source.
 * @return {string} Source with consistent function separation.
 */
export function separateFunctions(filename, text) {
  const file = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.JS);
  const edits = [];
  function isFunction(node) {
    return ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      (ts.isVariableStatement(node) && node.declarationList.declarations.some(
        declaration => declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))));
  }

  function examine(nodes) {
    for (let i = 1; i < nodes.length; i++) {
      const left = nodes[i - 1];
      const right = nodes[i];
      if (!isFunction(left) || !isFunction(right)) continue;
      const between = text.slice(left.end, right.getStart(file));
      const docStart = between.indexOf('/**');
      const nextStart = docStart >= 0 ? left.end + docStart :
        right.getStart(file);
      const preceding = text.slice(left.end, nextStart);
      if (/\n[ \t]*\n/.test(preceding)) continue;
      // After a JSDoc block begins, its own lines do not count as separation.
      const line = lineStart(text, nextStart);
      if (line > left.end && /^[ \t]*$/.test(text.slice(line, nextStart))) {
        edits.push(line);
      }
    }
  }

  function visit(node) {
    if (ts.isSourceFile(node) || ts.isBlock(node)) examine([...node
      .statements]);
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      examine([...node.members]);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const offset of [...new Set(edits)].sort((a, b) => b - a)) {
    text = text.slice(0, offset) + '\n' + text.slice(offset);
  }
  return text;
}

/**
 * Wraps long JavaScript expressions at parser-confirmed operator boundaries.
 * The function never splits a token or changes a literal's contents.
 * @param {string} filename Source file name for parser diagnostics.
 * @param {string} text JavaScript source.
 * @param {number=} limit Preferred line width.
 * @return {string} Source with long expression lines wrapped.
 */
export function wrapLongExpressions(filename, text, limit = 80) {
  const file = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.JS);
  const candidates = new Map();
  const lines = text.split('\n');
  const starts = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  function offer(position, priority = 1) {
    if (position <= 0 || position >= text.length) return;
    const start = lineStart(text, position);
    const width = lineLength(text, position);
    if (width <= limit) return;
    const relative = position - start;
    // Prevent ugly tiny fragments and avoid line breaks immediately before ';'.
    if (relative < 20 || relative >= width - 8) return;
    const preceding = text.slice(position - 6, position);
    if (/\b(?:return|throw|yield|await)\s*$/.test(preceding)) return;
    if (!candidates.has(start)) candidates.set(start, []);
    candidates.get(start).push({position, relative, priority});
  }

  function visit(node) {
    ts.forEachChild(node, visit);
    if (ts.isBinaryExpression(node)) {
      offer(node.operatorToken.end, 3);
    } else if (ts.isConditionalExpression(node)) {
      offer(node.questionToken.end, 2);
      offer(node.colonToken.end, 2);
    } else if (ts.isArrowFunction(node) &&
      !ts.isBlock(node.body)) {
      offer(node.equalsGreaterThanToken.end, 3);
    } else if (ts.isVariableDeclaration(node) && node.initializer) {
      // The first '=' after the declaration name belongs to this declaration.
      const between = text.slice(node.name.end, node.initializer
        .getStart(file));
      const equal = between.indexOf('=');
      if (equal >= 0) offer(node.name.end + equal + 1, 1);
    } else if (ts.isPropertyAccessExpression(node) &&
      !node.questionDotToken &&
      !ts.isIdentifier(node.expression) &&
      node.expression.kind !== ts.SyntaxKind.ThisKeyword &&
      node.expression.kind !== ts.SyntaxKind.SuperKeyword) {
      const dot = node.name.getStart(file) - 1;
      if (text[dot] === '.' && !text.slice(dot - 1, dot + 1).includes('\n')) {
        offer(dot, 2);
      }
    }
  }
  visit(file);
  const changes = [];
  for (const [start, entries] of candidates) {
    const current = lines[starts.indexOf(start)];
    if (current.length <= limit) continue;
    const safe = entries.filter(item => item.relative <= limit - 4 &&
      item.relative >= 24);
    if (!safe.length) continue;
    safe.sort((a, b) => (b.relative + b.priority * 2) -
      (a.relative + a.priority * 2));
    const chosen = safe[0];
    const indent = indentation(text, start);
    const rest = text.slice(chosen.position);
    if (/^\s*\n/.test(rest)) continue;
    changes.push({
      position: chosen.position,
      replacement: `\n${' '.repeat(indent + 4)}`,
    });
  }
  for (const {position, replacement} of changes.sort(
    (a, b) => b.position - a.position)) {
    text = text.slice(0, position) + replacement +
      text.slice(position).replace(/^ */, '');
  }
  return text;
}

/**
 * Formats overlong standalone comments without touching string literals.
 * JSDoc tags retain their type expressions, even if those are indivisible.
 * @param {string} filename JavaScript source filename.
 * @param {string} source Original JavaScript source.
 * @param {number=} limit Preferred line width.
 * @return {string} Source with readable comment line breaks.
 */
export function wrapStandaloneComments(filename, source, limit = 80) {
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.JS);
  const literalRanges = [];
  function gather(node) {
    if (ts.isTemplateLiteralToken(node) || ts.isStringLiteral(node) ||
      ts.isRegularExpressionLiteral(node)) {
      literalRanges.push([node.getStart(parsed), node.end]);
    }
    ts.forEachChild(node, gather);
  }
  gather(parsed);
  function insideLiteral(pos) {
    return literalRanges.some(([start, end]) => start <= pos && pos < end);
  }

  function words(text, prefix) {
    const max = limit - prefix.length;
    const segments = [];
    let current = '';
    for (const part of text.split(/\s+/)) {
      if (current && current.length + 1 + part.length > max) {
        segments.push(prefix + current);
        current = part;
      } else {
        current += (current ? ' ' : '') + part;
      }
    }
    if (current) segments.push(prefix + current);
    return segments;
  }
  const lines = source.split('\n');
  let offset = 0;
  const output = [];
  for (const line of lines) {
    const length = line.length;
    const start = offset + line.search(/\S/);
    offset += line.length + 1;
    if (length <= limit || line.search(/\S/) < 0 ||
      insideLiteral(start)) {
      output.push(line);
      continue;
    }
    const indentation = /^ */.exec(line)[0];
    const trimmed = line.trim();
    const inlineDoc = /^\/\*\* (.+) \*\/$/.exec(trimmed);
    if (inlineDoc && inlineDoc[1].length < 300) {
      output.push(indentation + '/**');
      output.push(...words(inlineDoc[1], indentation + ' * '));
      output.push(indentation + ' */');
      continue;
    }
    if (/^\/\/ /.test(trimmed) && !/^\/\/\s*(?:https?:\/\/|eslint|istanbul)/
      .test(trimmed)) {
      output.push(...words(trimmed.slice(3), indentation + '// '));
      continue;
    }
    if (/^\* @(?:param|return|throws)\s+/.test(trimmed)) {
      const brace = trimmed.indexOf('{');
      let depth = 0;
      let close = -1;
      for (let i = brace; i >= 0 && i < trimmed.length; i++) {
        if (trimmed[i] === '{') depth += 1;
        if (trimmed[i] === '}') depth -= 1;
        if (trimmed[i] === '}' && depth === 0) {
          close = i;
          break;
        }
      }
      if (close >= 0) {
        const afterType = trimmed.slice(close + 1).trim();
        const isParam = trimmed.startsWith('* @param');
        const name = isParam ? /^\S+/.exec(afterType)?.[0] : '';
        const description = afterType.slice(name?.length ?? 0).trim();
        const head = indentation + trimmed.slice(0, close + 1) +
          (name ? ` ${name}` : '');
        const continuation = indentation + '*     ';
        if (description && head.length < limit - 10) {
          const parts = words(description, continuation);
          const first = description.split(/\s+/)[0];
          if (head.length + 1 + first.length <= limit) {
            // Keep the first words on the tag line when there is room.
            const remaining = description.split(/\s+/);
            let firstLine = head;
            while (remaining.length && firstLine.length + 1 +
              remaining[0].length <= limit) {
              firstLine += ` ${remaining.shift()}`;
            }
            output.push(firstLine);
            if (remaining.length) {
              output.push(...words(remaining.join(' '), continuation));
            }
          } else {
            output.push(head, ...parts);
          }
          continue;
        }
      }
    }
    if (/^\* (?!@)/.test(trimmed) &&
      !/\*\/\s*$/.test(trimmed) && !/\{[^}]*$/.test(trimmed)) {
      output.push(...words(trimmed.slice(2), indentation + '* '));
      continue;
    }
    output.push(line);
  }
  return output.join('\n');
}

/**
 * Adds Google's recommended trailing comma to multiline array/object literals.
 * Rest-binding patterns and elided array entries are deliberately excluded.
 * @param {string} filename Source file name for syntax analysis.
 * @param {string} source JavaScript source.
 * @return {string} Source with safe trailing commas in multiline literals.
 */
export function insertTrailingCommas(filename, source) {
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.JS);
  const insertions = [];
  function visit(node) {
    ts.forEachChild(node, visit);
    const object = ts.isObjectLiteralExpression(node);
    const array = ts.isArrayLiteralExpression(node);
    if (!object && !array) return;
    const elements = [...(object ? node.properties : node.elements)];
    if (!elements.length) return;
    const last = elements.at(-1);
    if (ts.isOmittedExpression(last)) return;
    const closing = node.end - 1;
    const between = source.slice(last.end, closing);
    if (!between.includes('\n') || /^\s*,/.test(between) ||
      source[closing] !== (object ? '}' : ']')) return;
    insertions.push(last.end);
  }
  visit(parsed);
  for (const position of [...new Set(insertions)].sort((a, b) => b - a)) {
    source = source.slice(0, position) + ',' + source.slice(position);
  }
  return source;
}
