import posthtml from 'posthtml';
import { LoaderContext } from '../webpack-loader-api';

const createNodeFilter = (tags: string[]) => (
  node: posthtml.NodeTreeElement,
): node is posthtml.Node =>
  typeof node === 'object' && (tags.length === 0 || tags.includes(node.tag as any));

const getRoot = (tree: posthtml.Api) => tree.find(createNodeFilter(['root']));

const getIncludeRoots = (tree: posthtml.Api) =>
  (getRoot(tree)?.content ?? []).filter(createNodeFilter(['scripts', 'styles']));

export const preserveIncludesBefore: posthtml.Plugin = (tree: posthtml.Api) => {
  getIncludeRoots(tree)
    .flatMap((x) => x.content)
    .filter(createNodeFilter(['include']))
    .forEach((node) => {
      node.tag = 'panorama-include';
    });
};

export const preserveIncludesAfter: posthtml.Plugin = (tree) => {
  getIncludeRoots(tree)
    .flatMap((x) => x.content)
    .filter(createNodeFilter(['panorama-include']))
    .forEach((node) => {
      node.tag = 'include';
    });
};

export const validateIncludes = (context: LoaderContext): posthtml.Plugin => (tree) => {
  for (const scope of getIncludeRoots(tree)) {
    for (const node of scope.content) {
      if (typeof node !== 'object') continue;

      if (node.tag !== 'include') {
        context.emitError(new Error(`Unexpected tag '${node.tag}'`));
        continue;
      }

      const { src } = node.attrs;
      if (src == null) {
        context.emitError(new Error('<include> tag is missing "src" attribute'));
        continue;
      }

      if (scope.tag === 'styles') {
        if (!src.endsWith('.css') && !src.endsWith('.vcss_c')) {
          context.emitError(new Error(`Dependency '${src}' has invalid extension`));
        }
      } else if (scope.tag === 'scripts') {
        if (!src.endsWith('.js') && !src.endsWith('.vjs_c') && !src.endsWith('.ts') && !src.endsWith('.vts_c')) {
          context.emitError(new Error(`Dependency '${src}' has invalid extension`));
        }
      }
    }
  }
};
