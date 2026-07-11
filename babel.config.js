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
      // react-native-worklets plugin — REQUIRED for react-native-reanimated v4
      // (drives useAnimatedStyle / useAnimatedScrollHandler worklets). Without it
      // animated styles silently never update — e.g. the Explorer parallax heroes.
      // Must be the LAST plugin in the list.
      'react-native-worklets/plugin',
    ],
  };
};
