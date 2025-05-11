const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Resolve `node-libs-react-native` module path for shims
const nodeLibs = require.resolve('node-libs-react-native');

defaultConfig.resolver = {
  ...defaultConfig.resolver,
  extraNodeModules: {
    // Point Node.js core modules to the shims provided by node-libs-react-native
    ...require(nodeLibs),

    // Some modules might need specific shims if not perfectly covered or
    // if you prefer a specific implementation over what node-libs-react-native provides.
    // For example, if you still face issues with 'crypto' or want to ensure your specific one is used:
    // crypto: require.resolve('react-native-crypto'),

    // stream might still benefit from readable-stream for more complete compatibility
    stream: require.resolve('readable-stream'),

    // Modules that are not available and should be stubbed (return an empty module)
    // You can create an empty an 'empty-module.js' file in your project (e.g., in apps/mobile/src)
    // and then use: fs: require.resolve('./src/empty-module.js'),
    fs: false, // Or path to an empty module shim if required
    child_process: false,
    worker_threads: false,
    // 'net' and 'tls' are notoriously hard to polyfill fully.
    // node-libs-react-native might provide some stubs or basic versions.
    // If they are still problematic, you might need to use react-native-tcp-socket for net
    // and react-native-tls or just stub them if their full functionality isn't used by ws in RN context.
    net: require.resolve('react-native-tcp-socket'), // Keeping our specific shims for these as they are tricky
    tls: require.resolve('react-native-tls'),
  },
};

module.exports = defaultConfig;