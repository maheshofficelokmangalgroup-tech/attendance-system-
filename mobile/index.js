import { registerRootComponent } from "expo";
import App from "./App";

// registerRootComponent both registers the component and wires up Expo Go /
// dev-client vs. standalone-build entry points correctly.
registerRootComponent(App);
