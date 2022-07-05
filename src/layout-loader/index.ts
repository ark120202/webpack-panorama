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
    let lessList = {};
    let tsx = source.match(/<include src="(.*tsx)".*\/>/g)?.map((context) => {
      return context.replace(/<include src="(.*tsx)".*\/>/g, "$1");
    })?.map((context) => {
      lessList = resolveImport(this.context, path.resolve(this.context, context));
    });
    let includes = "";
    for (const lessPath in lessList) {
      includes += `\n\t\t<include src=\"${path.relative(this.context, lessPath).replace(/\\/g, "/")}\"/>`;
    }
    if (tsx && includes != "") {
      source = source.replace(/(.*<\/styles>)/, includes + "\n$1");
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

/** 递归解析所有的import，暂时只支持tsx */
function resolveImport(layoutPath: string, importPath: string) {
  let list: { [k: string]: boolean; } = {};
  const content = fs.readFileSync(importPath, "utf-8");
  const importList = content.match(/import.*('|")(\.\.\/.*|\.\/.*)('|");/g)?.map((relativePath) => {
    return relativePath.replace(/import.*('|")(\.\.\/.*|\.\/.*)('|");/g, "$2");
  })?.map((relativePath) => {
    return path.resolve(layoutPath, relativePath);
  });
  if (importList) {
    importList.forEach(element => {
      if (element.search(/.*.less/) != -1) {
        list[element] = true;
      } else {
        let exists = fs.existsSync(element + ".tsx");
        if (exists) {
          list = Object.assign(list, resolveImport(path.dirname(element + ".tsx"), element + ".tsx"));
        }
      }
    });
  }
  return list;
}