const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const BACKEND_API = (
  process.env.EXPO_PUBLIC_API_URL ||
  'https://mespochesbackend-production-9835.up.railway.app/api'
).replace(/\/$/, '');

function proxyToBackend(req, res) {
  const suffix = (req.url || '').replace(/^\/__mp_api/, '') || '/';
  const target = new URL(BACKEND_API + suffix);
  const lib = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: target.host };
  delete headers.origin;
  delete headers.referer;

  const upstream = lib.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers,
    },
    (incoming) => {
      res.writeHead(incoming.statusCode || 502, incoming.headers);
      incoming.pipe(res);
    }
  );

  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ success: false, message: 'Backend injoignable' }));
  });

  req.pipe(upstream);
}

const config = getDefaultConfig(__dirname);

const existingBlock = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlock) ? existingBlock : existingBlock ? [existingBlock] : []),
  /[\\/]android[\\/](?:app[\\/])?build[\\/]/,
  /[\\/]android[\\/]\.gradle[\\/]/,
  /[\\/]android[\\/]\.cxx[\\/]/,
  /[\\/]\.transforms[\\/]/,
  /[\\/]\.git[\\/]/,
  // Exports web et caches : inutiles à surveiller (Windows : limite de fichiers ouverts → EMFILE).
  /[\\/]mes-poches-mobile[\\/]dist[\\/]/,
  /[\\/]node_modules[\\/]\.cache[\\/]/,
];
if (process.platform === 'win32') {
  config.maxWorkers = 2;
}

const FILE_SYSTEM = {
  'expo-file-system': path.resolve(__dirname, 'node_modules/expo-file-system/src/index.ts'),
  'expo-file-system/legacy': path.resolve(
    __dirname,
    'node_modules/expo-file-system/src/legacy/index.ts'
  ),
};

const assetExts = new Set(config.resolver.assetExts ?? []);
assetExts.add('wasm');
config.resolver.assetExts = [...assetExts];
config.resolver.sourceExts = (config.resolver.sourceExts ?? []).filter((ext) => ext !== 'wasm');

const previousResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (typeof moduleName === 'string' && moduleName.includes('wa-sqlite.wasm')) {
    return { type: 'empty' };
  }
  if (typeof moduleName === 'string' && moduleName.startsWith('@/assets/')) {
    const rel = './assets/' + moduleName.slice('@/assets/'.length).replace(/\\/g, '/');
    return context.resolveRequest(context, rel, platform);
  }
  const mapped = FILE_SYSTEM[moduleName];
  if (mapped) {
    return { type: 'sourceFile', filePath: mapped };
  }
  if (previousResolve) {
    return previousResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.transformer = {
  ...config.transformer,
  assetPlugins: [...(config.transformer?.assetPlugins ?? []), path.resolve(__dirname, 'plugins/metro-forward-slash-assets.js')],
};

const previous = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware, server) => {
    const inner = typeof previous === 'function' ? previous(metroMiddleware, server) : metroMiddleware;
    return (req, res, next) => {
      if (req.url) {
        req.url = req.url.replace(/%5C/gi, '/').replace(/\\/g, '/');
      }
      if (req.url && req.url.startsWith('/__mp_api')) {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          });
          res.end();
          return;
        }
        proxyToBackend(req, res);
        return;
      }
      return inner(req, res, next);
    };
  },
};

module.exports = config;
