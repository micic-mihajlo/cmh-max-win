/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'clip',
  name: 'clip',
  displayName: 'SIGNAL',
  bundleIdentifier: `${config.ios.bundleIdentifier}.Clip`,
  icon: '../../assets/images/icon.png',
  deploymentTarget: '17.6',
  entitlements: {
    'com.apple.developer.associated-domains': config.ios.associatedDomains.filter((d) => d.startsWith('appclips:')),
  },
});
