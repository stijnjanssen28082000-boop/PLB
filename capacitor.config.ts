import type { CapacitorConfig } from '@capacitor/cli';

// D.5: the test build must be impossible to confuse with production — different
// app id, different name on the device. D.12: the iOS configuration is carried
// along from the start but its pipeline is only activated before phase 5.
const isProduction = process.env.VITE_APP_ENV === 'production';

const config: CapacitorConfig = {
  appId: isProduction ? 'be.monet.plaatsbeschrijving' : 'be.monet.plaatsbeschrijving.test',
  appName: isProduction ? 'Plaatsbeschrijving' : 'Plaatsbeschrijving TEST',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      androidIsEncryption: false,
    },
  },
};

export default config;
