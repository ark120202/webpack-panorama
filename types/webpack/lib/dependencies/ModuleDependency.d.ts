import webpack from 'webpack';

declare class ModuleDependency extends webpack.Dependency {
  request: string;
  userRequest: string;
  constructor(request: string);
}

export = ModuleDependency;
