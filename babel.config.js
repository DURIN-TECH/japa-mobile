module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Transform import.meta for web compatibility
      function () {
        return {
          visitor: {
            MetaProperty(path) {
              path.replaceWithSourceString('process');
            },
          },
        };
      },
    ],
  };
};
