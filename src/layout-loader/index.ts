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
  this.cacheable(false);

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

    this._compilation.hooks.processAssets.tap(
      { name: 'layout-loader', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE },
      () => {
        for (const chunk of this._compilation.chunkGraph.getModuleChunks(this._module)) {
          for (const file of chunk.files) {
            this._compilation.updateAsset(file, new webpack.sources.RawSource(html));
          }
        }
      },
    );

    callback(null, '');
  } catch (error) {
    callback(error);
  }
}
