import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'baligya_app',
  webDir: 'www',
  android: {
    // Dev-only: the WebView loads pages from https://localhost but our
    // Laravel API is plain http. Without this, Chromium blocks HTTP
    // requests from the HTTPS origin as "mixed content". Switch this off
    // (and serve the API over HTTPS) before shipping a release build.
    allowMixedContent: true,
  },
};

export default config;
