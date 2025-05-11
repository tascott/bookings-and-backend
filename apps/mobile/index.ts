import 'react-native-url-polyfill/auto'; // MUST be the first import
import 'react-native-get-random-values'; // For crypto shims
import { registerRootComponent } from 'expo';

import App from './src/App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
