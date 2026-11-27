const { withInfoPlist } = require('expo/config-plugins');
module.exports = function withIOSProductionSecurity(config) {
  return withInfoPlist(config, (config) => {
    const plist = config.modResults;
    plist.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: false,
    };
    plist.NSLocationWhenInUseUsageDescription =
      'Allow Divyakshetra Hariharapura to use your current location to display location-based Panchangam information.';
    plist.NSLocationAlwaysUsageDescription =
      'Location is used for location-based Panchangam information. The app requests location access only while in use.';
    plist.NSLocationAlwaysAndWhenInUseUsageDescription =
      'Location is used for location-based Panchangam information. The app does not request background location access.';
    plist.NSMotionUsageDescription =
      'Location-related system libraries may access motion information to support location services. The app does not directly request motion activity access.';
    plist.NSPhotoLibraryAddUsageDescription =
      'Allow Divyakshetra Hariharapura to save temple gallery photographs to your photo library.';
    // The welcome Slokam is foreground playback.
    // Do not enable background audio or location.
    if (Array.isArray(plist.UIBackgroundModes)) {
      plist.UIBackgroundModes =
        plist.UIBackgroundModes.filter(
          mode => mode !== 'audio' && mode !== 'location'
        );
      if (plist.UIBackgroundModes.length === 0) {
        delete plist.UIBackgroundModes;
      }
    }
    return config;
  });
};