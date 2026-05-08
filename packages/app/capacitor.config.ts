import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.oconsole.o_cli',
  appName: 'OdooCLI',
  webDir: 'dist',
  server: {
    allowNavigation: ['35.154.153.108']
  }
};

export default config;
