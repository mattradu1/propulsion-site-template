// Shared headless Chromium launcher (pre-installed Playwright Chromium; never downloads a browser).
import fs from 'node:fs';
import { chromium } from 'playwright-core';
export const CHROME = process.env.CHROME_PATH
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
// Keep Chromium from calling Google services: nothing leaves the machine.
export const CHROME_FLAGS = ['--no-sandbox', '--no-proxy-server', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-default-apps', '--no-first-run', '--disable-domain-reliability', '--disable-client-side-phishing-detection', '--metrics-recording-only', '--disable-features=AutofillServerCommunication,OptimizationHints,MediaRouter,Translate,CertificateTransparencyComponentUpdater', '--no-pings'];
export const launch = () => chromium.launch({ executablePath: CHROME, args: CHROME_FLAGS });
export const routesOf = (dir) => JSON.parse(fs.readFileSync(`${dir}/build-info.json`, 'utf8')).routes;
