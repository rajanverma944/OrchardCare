// RN 0.79's lazy `react-native` entry no longer runs InitializeCore
// automatically, so the fetch / XMLHttpRequest / FormData / Blob globals are
// NOT installed by merely importing react-native. Importing InitializeCore
// here (before App loads any module that expects web APIs) restores them.
import 'react-native/Libraries/Core/InitializeCore';

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
