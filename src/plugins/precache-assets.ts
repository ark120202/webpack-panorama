import HtmlWebpackPlugin from 'html-webpack-plugin';
import { URL } from 'url';
import webpack from 'webpack';

export interface PrecachePanoramaAssetsPluginOptions {
  filter?: RegExp;
}

export class PrecachePanoramaAssetsPlugin {
  private readonly filter: RegExp;
  constructor({ filter = /\.(png|je?pg)$/ }: PrecachePanoramaAssetsPluginOptions = {}) {
    this.filter = filter;
  }

  public apply(compiler: webpack.Compiler) {
    compiler.hooks.compilation.tap(this.constructor.name, (compilation) => {
      const publicPath = compilation.getPath(compilation.outputOptions.publicPath ?? '');

      const htmlHooks = HtmlWebpackPlugin.getHooks(compilation);

      htmlHooks.beforeEmit.tap(this.constructor.name, (args) => {
        const assetUrls = Object.keys(compilation.assets)
          .filter((assetName) => this.filter.test(assetName))
          .map((assetName) => new URL(assetName, publicPath).toString());

        if (assetUrls.length > 0) {
          args.html = `<!--\n${assetUrls.map((x) => `"${x}"`).join('\n')}\n-->\n${args.html}`;
        }

        return args;
      });
    });
  }
}
