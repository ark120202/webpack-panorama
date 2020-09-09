import _ from 'lodash';
import posthtml from 'posthtml';
import { LoaderContext } from '../webpack-loader-api';

const xmlCommentRegex = /^<!--(.*?)-->$/s;
export const banTextNodes = (context: LoaderContext): posthtml.Plugin => (tree) => {
  tree.match(/^\s*\S/, (node) => {
    const content = node.trim();
    if (xmlCommentRegex.test(content)) return node;

    context.emitError(new Error(`Text node '${content}' is not allowed.`));

    const xmlContent = _.escape(content).replace(/\\/g, '\\\\\\\\');
    return {
      attrs: {
        style: 'color: red; font-size: 32px;',
        text: `Error: text node '${xmlContent}' is not allowed.`,
      },
      content: [],
      tag: 'Label',
    };
  });

  return tree;
};
