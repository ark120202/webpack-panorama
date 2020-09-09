import { ImportMessage } from '@posthtml/esm';
import posthtml from 'posthtml';
import { promisify } from 'util';
import vm from 'vm';
import { LoaderContext } from '../webpack-loader-api';

const { parser, render } = posthtml();

function evaluateModule(publicPath: string, filename: string, source: string) {
  if (source === '') throw new Error("The child compilation didn't provide a result");

  const script = new vm.Script(source, { filename, displayErrors: true });
  const vmContext = {
    __webpack_public_path__: publicPath,
    exports: {},
    module: { exports: {} },
  };
  const sandbox = vm.createContext(vmContext) as typeof vmContext;
  sandbox.module.exports = sandbox.exports;

  script.runInContext(sandbox);

  const exported: any = sandbox.module.exports;

  if (typeof exported !== 'string') {
    throw new TypeError(
      `${filename} expected to export constant string, but got ${typeof exported}`,
    );
  }

  return exported;
}

const isImportMessage = (message: posthtml.Message): message is ImportMessage =>
  message.type === 'import';

export const loadImports = (context: LoaderContext): posthtml.Plugin => async (tree) => {
  const publicPath = context._compilation.getPath(
    context._compilation.outputOptions.publicPath ?? '',
  );

  let html = render(tree);

  const loadedModules = await Promise.all(
    tree.messages.filter(isImportMessage).map(async (message) => {
      const source = await promisify(context.loadModule)(message.url);
      const result = evaluateModule(publicPath, message.url, source);
      return { name: message.name, result };
    }),
  );

  for (const module of loadedModules) {
    html = html.replace(`\${${module.name}}`, module.result);
  }

  return parser(html);
};
