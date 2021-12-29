import posthtml from 'posthtml';
import { imports, urls } from '@posthtml/esm';
import webpack from 'webpack';
import { LoaderContext } from '../webpack-loader-api';
import { banTextNodes } from './posthtml-plugin-ban-text-nodes';
import { loadImports } from './posthtml-plugin-load-imports';
import {
  preserveIncludesAfter,
  preserveIncludesBefore,
  validateIncludes,
} from './posthtml-plugin-panorama-includes';

export interface PostHTMLLoaderMeta {
  ast?: { type: 'posthtml'; root: posthtml.Node[]; };
  messages: posthtml.Message[];
}

export default async function layoutLoader(
  this: LoaderContext,
  source: string,
  _map: never,
  meta?: PostHTMLLoaderMeta,
) {
  const options = this.getOptions();
  if (typeof options.cacheable == "boolean") {
    this.cacheable(options.cacheable);
  } else {
    this.cacheable(false);
  }

  const callback = this.async()!;

  const plugins: posthtml.Plugin[] = [
    preserveIncludesBefore,
    urls(),
    imports(),
    preserveIncludesAfter,

    loadImports(this),
    validateIncludes(this),

    banTextNodes(this),
  ];

  try {
    const input = meta?.ast?.type === 'posthtml' ? meta.ast.root : source;
    const { html } = await posthtml(plugins).process(input, {
      closingSingleTag: 'slash',
      xmlMode: true,
    });

    const compilation = this._compilation;
    const module = this._module;

    compilation.hooks.processAssets.tap(
      { name: 'layout-loader', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE },
      () => {
        for (const chunk of compilation.chunkGraph.getModuleChunks(module)) {
          for (const file of chunk.files) {
            compilation.updateAsset(file, new webpack.sources.RawSource(html));
          }
        }
      },
    );

    callback(null, '');
  } catch (error) {
    // @ts-ignore
    callback(error);
  }
}
