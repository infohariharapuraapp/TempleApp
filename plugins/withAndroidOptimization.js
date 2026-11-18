const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withAndroidOptimization(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error(
        "Android optimization plugin requires Groovy build.gradle"
      );
    }

    const current = 'getDefaultProguardFile("proguard-android.txt")';
    const optimized =
      'getDefaultProguardFile("proguard-android-optimize.txt")';

    if (config.modResults.contents.includes(current)) {
      config.modResults.contents =
        config.modResults.contents.replace(current, optimized);

      console.log("[Android Optimization] Optimized R8 preset enabled.");
    } else if (config.modResults.contents.includes(optimized)) {
      console.log("[Android Optimization] Already enabled.");
    } else {
      throw new Error(
        "[Android Optimization] Unable to locate ProGuard configuration."
      );
    }

    return config;
  });
};