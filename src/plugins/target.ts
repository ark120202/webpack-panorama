import webpack from 'webpack';

// We have to use an actual plugin, because "target" function is applied after config defaults
export class PanoramaTargetPlugin {
  public apply(compiler: webpack.Compiler) {
    const { options } = compiler;

    if (options.target !== undefined) {
      throw new Error("'target' option cannot be used with PanoramaTargetWebpackPlugin.");
    }

    options.target = 'es2017';

    // Overriding defaults from https://github.com/webpack/webpack/blob/86ca074290d5b6930c9a85a7eb4d4bd39f0b6509/lib/config/defaults.js

    // "eval" default isn't useful in Panorama
    options.devtool ??= false;

    // TODO: Add .xml asset default rule?

    options.output.globalObject ??= "(()=>this)()";
    options.output.enabledChunkLoadingTypes ??= [];

    if (options.optimization.splitChunks !== false) {
      options.optimization.splitChunks ??= {};
      options.optimization.splitChunks.cacheGroups ??= {};
      options.optimization.splitChunks.cacheGroups.default ??= false;
      options.optimization.splitChunks.cacheGroups.defaultVendors ??= false;
    }

    options.resolve ??= {};

    // Some modules (i.e. object-inspect) are using "browser" as non-node

    options.resolve.conditionNames ??= ['...'];
    if (options.resolve.conditionNames.includes('...')) {
      options.resolve.conditionNames.push('panorama');
      options.resolve.conditionNames.push('browser');
    }

    options.resolve.aliasFields ??= [];
    options.resolve.aliasFields.push('browser');

    options.resolve.mainFields ??= ['...'];
    if (options.resolve.mainFields.includes('...')) {
      options.resolve.mainFields.push('browser');
    }

    // https://github.com/webpack/webpack/blob/86ca074290d5b6930c9a85a7eb4d4bd39f0b6509/lib/WebpackOptionsApply.js#L72
    compiler.hooks.initialize.tap('PanoramaTargetWebpackPlugin', () => {
      new webpack.LoaderTargetPlugin('panorama').apply(compiler);
    });
  }
}
