module.exports = function forwardSlashAssets(assetData) {
  if (assetData && typeof assetData.httpServerLocation === 'string') {
    assetData.httpServerLocation = assetData.httpServerLocation.replace(/\\/g, '/');
  }
  return assetData;
};
