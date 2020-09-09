import { Plugin } from 'posthtml';

export function urls(options?: UrlsOptions): Plugin;
export interface UrlsOptions {
  url?: string | RegExp | ((url: string) => boolean);
}

export function imports(options?: ImportsOptions): Plugin;
export interface ImportsOptions {
  import?: string | RegExp | ((url: string) => boolean);
  template?: string;
}

export interface ImportMessage {
  type: 'import';
  plugin: '@posthtml/esm';
  url: string;
  name: string;
  import(): string;
}
