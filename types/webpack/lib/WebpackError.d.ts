import webpack from 'webpack';

type WebpackError = webpack.Compilation['errors'][number];
declare const WebpackError: new (message?: string) => WebpackError;

export = WebpackError;
