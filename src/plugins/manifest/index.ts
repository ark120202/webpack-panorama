import HtmlWebpackPlugin from 'html-webpack-plugin';
import yaml, { FAILSAFE_SCHEMA } from 'js-yaml';
import { interpolateName } from 'loader-utils';
import path from 'path';
import { promisify } from 'util';
import webpack from 'webpack';
import ModuleDependency from 'webpack/lib/dependencies/ModuleDependency';
import { makePathsRelative } from 'webpack/lib/util/identifier';
import {
  ManifestEntry,
  ManifestEntryType,
  PanoramaManifestError,
  validateManifest,
} from './manifest';

export { ManifestEntry, ManifestEntryType, manifestSchema } from './manifest';

export const manifestTemplatePath = path.resolve(__dirname, '../../../manifest-template.ejs');

class PanoramaEntryDependency extends ModuleDependency {
  // @ts-expect-error 'type' is defined as a property in class 'ModuleDependency', but is overridden here in 'PanoramaEntryDependency' as an accessor.
  public get type() {
    return 'panorama entry';
  }
}

interface XmlAsset {
  file: string;
  type: string;
}

export interface PanoramaManifestPluginOptions extends HtmlWebpackPlugin.Options {
  entries: string | ManifestEntry[];

  /**
   * @default '[path][name].[ext]'
   */
  entryFilename?: string;

  /**
   * js kv list, let sc
   */
  kv?: string[];
  /**
   * @default 'file://{resources}/layout/custom_game/kv/'
   */
  kv_path?: string;
}

const addEntry = promisify(webpack.Compilation.prototype.addEntry);

export class PanoramaManifestPlugin {
  private readonly entries: string | ManifestEntry[];
  private readonly entryFilename: string;
  private readonly htmlWebpackPlugin: HtmlWebpackPlugin;
  private readonly kv: string[] | undefined;
  private readonly kv_path: string = "file://{resources}/layout/custom_game/kv/";
  constructor({ entries, entryFilename, kv, kv_path, ...options }: PanoramaManifestPluginOptions) {
    this.entries = entries;
    this.entryFilename = entryFilename ?? '[path][name].[ext]';
    this.htmlWebpackPlugin = new HtmlWebpackPlugin({
      filename: 'custom_ui_manifest.xml',
      inject: false,
      template: manifestTemplatePath,
      xhtml: true,
      ...options,
    });
    if (kv) {
      this.kv = kv;
    }
    if (typeof kv_path == "string") {
      this.kv_path = kv_path;
    }
  }

  public apply(compiler: webpack.Compiler) {
    compiler.options.entry = {};

    this.htmlWebpackPlugin.apply(compiler);

    compiler.hooks.compilation.tap(
      this.constructor.name,
      (compilation, { normalModuleFactory }) => {
        compilation.dependencyFactories.set(PanoramaEntryDependency, normalModuleFactory);
      },
    );

    compiler.hooks.make.tapPromise(this.constructor.name, async (compilation) => {
      let manifestName: string | undefined;
      let manifestContext: string;
      let entries: ManifestEntry[];
      if (typeof this.entries === 'string') {
        manifestName = makePathsRelative(compiler.context, this.entries);
        manifestContext = path.dirname(this.entries);

        compilation.fileDependencies.add(this.entries);

        const { inputFileSystem } = compiler;
        const readFile = promisify(inputFileSystem.readFile.bind(inputFileSystem));
        const rawManifest = (await readFile(this.entries))!.toString('utf8');

        try {
          if (/\.ya?ml$/.test(this.entries)) {
            entries = ((yaml.load(rawManifest, { schema: FAILSAFE_SCHEMA })) ?? []) as ManifestEntry[];
          } else if (this.entries.endsWith('.json')) {
            entries = JSON.parse(rawManifest);
          } else {
            throw new Error(`Unknown file extension '${path.extname(this.entries)}'`);
          }
        } catch (error) {
          // @ts-ignore
          compilation.errors.push(new PanoramaManifestError(error.message, manifestName));
          return;
        }
      } else {
        manifestContext = compiler.context;
        entries = this.entries;
      }

      try {
        validateManifest(entries, manifestName);
      } catch (error) {
        // @ts-ignore
        compilation.errors.push(error);
        return;
      }

      const entryModuleTypes = new Map<webpack.Module, ManifestEntryType>();
      await Promise.all(
        entries.map(async (entry) => {
          const name = entry.filename ?? entry.import;
          const filename =
            entry.filename ??
            (() => {
              const extension = module.userRequest.endsWith('.xml') ? 'xml' : 'js';
              return interpolateName(
                { resourcePath: module.userRequest },
                this.entryFilename.replace('[ext]', extension),
                { context: compiler.context },
              );
            });

          const dep = new PanoramaEntryDependency(entry.import);
          dep.loc = { name };
          await addEntry.call(compilation, manifestContext, dep, { name, filename });
          const module = compilation.moduleGraph.getModule(dep) as webpack.NormalModule;

          if (entry.type != null) {
            if (module.userRequest.endsWith('.xml')) {
              entryModuleTypes.set(module, entry.type);
            } else {
              compilation.errors.push(
                new PanoramaManifestError(
                  `JavaScript '${entry.import}' entry point should not have 'type'.`,
                  manifestName,
                ),
              );
            }
          }
        }),
      );

      const htmlHooks = HtmlWebpackPlugin.getHooks(compilation);

      htmlHooks.beforeAssetTagGeneration.tap(this.constructor.name, (args) => {
        const xmlAssets: XmlAsset[] = [];

        for (const [module, type] of entryModuleTypes) {
          for (const chunk of compilation.chunkGraph.getModuleChunksIterable(module)) {
            for (const file of chunk.files) {
              if (file.endsWith('.xml')) {
                xmlAssets.push({ file: args.assets.publicPath + file, type });
              }
            }
          }
        }

        xmlAssets.sort((a, b) => {
          if (a.type > b.type) {
            return 1;
          }
          if (a.type < b.type) {
            return -1;
          }
          if (a.file > b.file) {
            return 1;
          }
          if (a.file < b.file) {
            return -1;
          }
          return 0;
        });

        (args.assets as any).xml = xmlAssets;

        if (this.kv != undefined) {
          for (let i = 0; i < this.kv.length; i++) {
            const kv_name = this.kv[i];
            args.assets.js.push(`${this.kv_path}${kv_name}.js`);
          }
        }

        return args;
      });
    });

    compiler.hooks.emit.tap(this.constructor.name, (compilation) => {
      for (const file in compilation.assets) {
        if (file.endsWith('.xml')) {
          // @ts-ignore
          if (compilation.assets[file]._valueAsString == undefined) {
            delete compilation.assets[file];
          }
        }
      }
    });
  }
}
