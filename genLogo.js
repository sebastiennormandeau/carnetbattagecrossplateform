const fs = require('fs');
const b64 = fs.readFileSync('C:/Dev/CarnetBattageCrossPlatform/assets/fondabec_logo.png').toString('base64');
const content = "export const FONDABEC_LOGO_BASE64 = 'data:image/png;base64," + b64 + "';";
fs.writeFileSync('C:/Dev/CarnetBattageCrossPlatform/src/config/fondabecLogoBase64.js', content);
