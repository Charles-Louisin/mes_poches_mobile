// Lance l'app web en développement, rapidement : application monopage et mémoire Node élargie.
// Usage : npm run web:dev   (API locale : EXPO_PUBLIC_API_URL=http://localhost:5000/api npm run web:dev)
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const child = spawn(
  process.execPath,
  ['--max-old-space-size=8192', path.join(root, 'node_modules/expo/bin/cli'), 'start', '--web', ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit', env: { ...process.env, EXPO_WEB_SPA: '1' } }
);
child.on('exit', (code) => process.exit(code ?? 0));
