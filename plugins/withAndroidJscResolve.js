/**
 * Config plugin to fix jsc-android "Read timed out" on JitPack during EAS Android build.
 * 1. Increases Gradle HTTP timeouts.
 * 2. Forces jsc-android to a concrete version so Gradle does not fetch maven-metadata.xml from JitPack.
 */
const { withGradleProperties, withProjectBuildGradle } = require("@expo/config-plugins/build/plugins/android-plugins");

const JSC_ANDROID_VERSION = "2026004.0";

function withAndroidJscResolve(config) {
  config = withGradleProperties(config, (c) => {
    const props = c.modResults;
    const timeout = "180000";
    const toAdd = [
      { type: "property", key: "systemProp.org.gradle.internal.http.connectionTimeout", value: timeout },
      { type: "property", key: "systemProp.org.gradle.internal.http.socketTimeout", value: timeout }
    ];
    for (const p of toAdd) {
      if (!props.some((x) => x.type === "property" && x.key === p.key)) {
        props.push(p);
      }
    }
    return c;
  });

  config = withProjectBuildGradle(config, (c) => {
    let contents = c.modResults.contents;
    if (contents.includes("jsc-android") && contents.includes(JSC_ANDROID_VERSION)) {
      return c;
    }
    const forceBlock = `
  configurations.all {
    resolutionStrategy {
      force 'io.github.react-native-community:jsc-android:${JSC_ANDROID_VERSION}'
    }
  }
`;
    if (contents.includes("allprojects {")) {
      contents = contents.replace(/allprojects\s*\{/, "allprojects {" + forceBlock);
    } else {
      contents += "\nallprojects {" + forceBlock + "}\n";
    }
    c.modResults.contents = contents;
    return c;
  });

  return config;
}

module.exports = withAndroidJscResolve;
