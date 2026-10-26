// @ts-check
/**
 * SLATE's own lint rules: the mandate held at the source, before the gate's matrix ever runs.
 *
 * - no-raw-text: every word the player reads comes from the text catalog through t(), so the inventory knows it.
 * - control-feature: every control (and anything with a handler) names its feature with data-feature, so the matrix
 *   can hold it to reading, biting and a downstream effect.
 * - shown-value-feature: a value drawn on a page sits inside an element that names its feature, so nothing is shown
 *   that the matrix doesn't hold.
 */

/** @typedef {import('eslint').Rule.RuleModule} RuleModule */
/** @typedef {any} Node */

const TEXT_ATTRIBUTES = new Set(['aria-label', 'aria-description', 'aria-valuetext', 'title', 'placeholder', 'alt', 'label']);
const CONTROLS = new Set(['button', 'input', 'select', 'textarea', 'a']);

/** A string written into the code: a quoted literal or a template. The node is absent for a bare attribute. @param {Node} node */
const isStringy = (node) => (node?.type === 'Literal' && typeof node.value === 'string') || node?.type === 'TemplateLiteral';

/** True when the element names its feature with a non-blank string literal, quoted or braced. @param {Node} opening */
function namesFeature(opening) {
  const a = opening.attributes.find((/** @type {Node} */ x) => x.type === 'JSXAttribute' && x.name.name === 'data-feature');
  const v = a?.value?.type === 'JSXExpressionContainer' ? a.value.expression : a?.value;
  return v?.type === 'Literal' && typeof v.value === 'string' && v.value.trim() !== '';
}

/** True when an expression rendered as a child is structure or catalog text, not a value shown. @param {Node} e @returns {boolean} */
function isStructural(e) {
  switch (e.type) {
    case 'JSXElement':
    case 'JSXFragment':
    case 'JSXEmptyExpression':
      return true;
    case 'Literal':
      return e.value === null;
    case 'Identifier':
      return e.name === 'undefined' || e.name === 'children';
    case 'ConditionalExpression':
      return isStructural(e.consequent) && isStructural(e.alternate);
    case 'LogicalExpression':
      return isStructural(e.right);
    case 'CallExpression':
      // t(...) is catalog text; list.map(...) draws elements, each held on its own.
      return e.callee.name === 't' || e.callee.property?.name === 'map';
    // Stryker disable next-line all: without it the function returns undefined, which every caller reads as false.
    default:
      return false;
  }
}

/** @type {RuleModule} */
const noRawText = {
  meta: { type: 'problem', schema: [], messages: { raw: 'Player-facing text comes from the text catalog through t(): "{{text}}".' } },
  create(context) {
    return {
      /** @param {Node} node */
      JSXText(node) {
        if (/\S/.test(node.value)) context.report({ node, messageId: 'raw', data: { text: node.value.trim().slice(0, 40) } });
      },
      /** @param {Node} node */
      JSXAttribute(node) {
        if (!TEXT_ATTRIBUTES.has(node.name.name)) return;
        const v = node.value?.type === 'JSXExpressionContainer' ? node.value.expression : node.value;
        if (isStringy(v)) context.report({ node, messageId: 'raw', data: { text: String(v.value ?? '`…`').slice(0, 40) } });
      },
      /** @param {Node} node */
      JSXExpressionContainer(node) {
        if (node.parent.type !== 'JSXAttribute' && isStringy(node.expression)) {
          context.report({ node, messageId: 'raw', data: { text: String(node.expression.value ?? '`…`').slice(0, 40) } });
        }
      },
    };
  },
};

/** @type {RuleModule} */
const controlFeature = {
  meta: { type: 'problem', schema: [], messages: { missing: 'A control names its feature: data-feature="<registered id>" ({{what}}).' } },
  create(context) {
    return {
      /** @param {Node} node */
      JSXOpeningElement(node) {
        const name = node.name.name;
        const intrinsic = node.name.type === 'JSXIdentifier' && /^[a-z]/.test(name);
        const handler = node.attributes.some((/** @type {Node} */ a) => a.type === 'JSXAttribute' && /^on[A-Z]/.test(a.name.name));
        if (!(intrinsic && (CONTROLS.has(name) || handler))) return;
        if (!namesFeature(node)) context.report({ node, messageId: 'missing', data: { what: `<${name}>` } });
      },
    };
  },
};

/** @type {RuleModule} */
const shownValueFeature = {
  meta: { type: 'problem', schema: [], messages: { unmarked: 'A value shown on a page sits inside an element with data-feature="<registered id>".' } },
  create(context) {
    return {
      /** @param {Node} node */
      JSXExpressionContainer(node) {
        if (node.parent.type !== 'JSXElement' && node.parent.type !== 'JSXFragment') return;
        if (isStructural(node.expression)) return;
        for (let p = node.parent; p; p = p.parent) {
          if (p.type === 'JSXElement' && namesFeature(p.openingElement)) return;
        }
        context.report({ node, messageId: 'unmarked' });
      },
    };
  },
};

export default {
  meta: { name: 'eslint-plugin-slate' },
  rules: { 'no-raw-text': noRawText, 'control-feature': controlFeature, 'shown-value-feature': shownValueFeature },
};
