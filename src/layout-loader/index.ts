import posthtml from 'posthtml';
import { imports, urls } from '@posthtml/esm';
import webpack from 'webpack';
import path from 'path';
import fs from 'fs';
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
    // 处理导入css写到xml中
    let tsx = source.match(/<include src="(.*tsx)".*\/>/g)?.map((context) => {
      return context.replace(/<include src="(.*tsx)".*\/>/g, "$1");
    })?.map((context) => {
      return path.resolve(this.context, context);
    });
    if (tsx) {
      let includes = "";
      tsx.forEach(element => {
        let text = fs.readFileSync(element, "utf-8");
        if (text.search(/import.*.less.*;/) != -1) {
          let lessList = text.match(/import ('|")(.*less)('|");/g)?.map((context) => {
            return context.replace(/import ('|")(.*less)('|");/g, "$2");
          })?.map((context) => {
            return path.resolve(this.context, context);
          })?.map((context) => {
            return path.relative(this.context, context);
          });

          if (lessList) {
            lessList.forEach(less => {
              includes += `\n\t\t<include src=\"${less.replace(/\\/g, "/")}\"/>`;
            });
          }

        }
      });
      if (includes != "") {
        source = source.replace(/(.*<\/styles>)/, includes + "\n$1");
      }
    }

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
