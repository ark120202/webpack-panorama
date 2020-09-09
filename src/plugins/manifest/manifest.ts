import validateOptions from 'schema-utils';
import WebpackError from 'webpack/lib/WebpackError';
import manifestSchema from './manifest.schema.json';

export { manifestSchema };

export interface ManifestEntry {
  /**
   * Module(s) that are loaded upon startup.
   */
  import: string;

  /**
   * Specifies the name of the output file on disk.
   *
   * @example
   * { import: './loading-screen/layout.xml', filename: 'custom_loading_screen.xml' }
   */
  filename?: string | null;

  /**
   * Type of a Custom UI.
   *
   * When not provided, this entry would be omitted from `custom_ui_manifest.xml` file.
   *
   * Can be defined only for XML entrypoints.
   */
  type?: ManifestEntryType | null;
}

export type ManifestEntryType =
  | 'GameSetup'
  | 'HeroSelection'
  | 'Hud'
  | 'HudTopBar'
  | 'FlyoutScoreboard'
  | 'GameInfo'
  | 'EndScreen';

const getErrorName = (manifestName?: string) =>
  `PanoramaManifestPlugin${manifestName !== undefined ? ` (${manifestName})` : ''}`;

export class PanoramaManifestError extends WebpackError {
  public name = 'PanoramaManifestError';
  constructor(message: string, manifestName?: string) {
    super(`${getErrorName(manifestName)}\n${message}`);
  }
}

export function validateManifest(manifest: ManifestEntry[], manifestName?: string) {
  validateOptions(manifestSchema.items as any, manifest, {
    baseDataPath: 'manifest',
    name: getErrorName(manifestName),
  });
}
