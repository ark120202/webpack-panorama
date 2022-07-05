export default async function tsCssLoader(source: string) {
    if (source.search(/import.*.less.*;/) != -1) {
        source = source.replace(/import.*.(less|sass|scss|css).*;/g, "");
    }
    return source;
}
exports.default = tsCssLoader;