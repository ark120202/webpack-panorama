import { interpolateName } from 'loader-utils';
import path from 'path';
import webpack from 'webpack';
import { LoaderContext } from './webpack-loader-api';

export interface EntryLoaderOptions {
  filename?: string;
  plugins?: (string | webpack.WebpackPluginInstance)[];
}

export function pitch(this: LoaderContext) {
  this.cacheable(false);
  this.addDependency(this.resourcePath);

  const options: EntryLoaderOptions = this.getOptions();
  const filenameTemplate = options.filename ?? '[path][name].js';
  const filename = interpolateName(this, filenameTemplate, { context: this.rootContext });
  const compiler = createCompiler(this, filename, options.plugins ?? []);

  const callback = this.async()!;
  compiler.runAsChild((error, entries, compilation) => {
    (compilation?.warnings ?? []).forEach((e) => this.emitWarning(e));
    (compilation?.errors ?? []).forEach((e) => this.emitError(e));

    if (error) {
      callback(error);
    } else if (entries!.length > 0) {
      const file = [...entries![0].files][0];
      callback(null, `module.exports = __webpack_public_path__ + ${JSON.stringify(file)};`);
    } else {
      callback(null, '');
    }
  });
}

function createCompiler(
  loader: LoaderContext,
  filename: string,
  pluginsOption: NonNullable<EntryLoaderOptions['plugins']>,
) {
  const { _compilation: oldCompilation, _compiler: oldCompiler } = loader;
  const outputOptions = { ...oldCompilation.outputOptions, filename };

  const allowedPlugins = new Set(pluginsOption.filter((x): x is string => typeof x === 'string'));
  const plugins = [
    ...oldCompiler.options.plugins.filter((p) => allowedPlugins.has(p.constructor.name)),
    ...pluginsOption.filter((x): x is webpack.WebpackPluginInstance => typeof x !== 'string'),
  ];

  const compilerName = path.relative(oldCompiler.context, loader.resourcePath);
  // @ts-expect-error Type 'WebpackPluginInstance' is not assignable to type 'Plugin'.
  const childCompiler = oldCompilation.createChildCompiler(compilerName, outputOptions, plugins);

  const { rawRequest } = loader._module as webpack.NormalModule;
  new webpack.EntryPlugin(loader.context, rawRequest, 'main').apply(childCompiler);

  return childCompiler;
}
