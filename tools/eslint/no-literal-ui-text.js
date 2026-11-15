/**
 * smart-kit/no-literal-ui-text: user-visible text must come from the message files (AC-I18N-02).
 * Flags JSX text and string literals in text-bearing JSX attributes, except whitespace and punctuation.
 */
const TEXT_ATTRIBUTES = new Set(['title', 'label', 'placeholder', 'aria-label', 'alt', 'description', 'tooltip', 'aria-description', 'aria-placeholder']);
const isText = (s) => /[\p{L}\p{N}]/u.test(s);

export default {
  meta: { type: 'problem', docs: { description: 'Disallow literal UI text in components' }, schema: [], messages: { text: 'Literal UI text "{{text}}": use useText() and the message files.' } },
  create(context) {
    const report = (node, text) => context.report({ node, messageId: 'text', data: { text: text.trim().slice(0, 40) } });
    return {
      JSXText(node) {
        if (isText(node.value)) report(node, node.value);
      },
      JSXAttribute(node) {
        const name = typeof node.name.name === 'string' ? node.name.name : '';
        if (!TEXT_ATTRIBUTES.has(name) || !node.value) return;
        if (node.value.type === 'Literal' && typeof node.value.value === 'string' && isText(node.value.value)) report(node.value, node.value.value);
        if (node.value.type === 'JSXExpressionContainer' && node.value.expression.type === 'Literal' && typeof node.value.expression.value === 'string' && isText(node.value.expression.value)) report(node.value, node.value.expression.value);
        if (node.value.type === 'JSXExpressionContainer' && node.value.expression.type === 'TemplateLiteral' && node.value.expression.quasis.some((q) => isText(q.value.cooked ?? ''))) report(node.value, 'template');
      },
    };
  },
};
