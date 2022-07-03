"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function tsCssLoader(source, _map, meta) {
    if (source.search(/import.*.less.*;/) != -1) {
        source = source.replace(/import.*.less.*;/g, "");
    }
    return source;
}
exports.default = tsCssLoader;