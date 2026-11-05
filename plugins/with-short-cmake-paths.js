const { withSettingsGradle } = require('expo/config-plugins');

const MARKER = '// better-alarms: short CMake build folders';

// Native libraries (Reanimated, Worklets...) compile C++ with CMake, which nests
// the full source path inside its build folder. On Windows that blows past the
// 260-character path limit. Local builds therefore:
//  - put those folders under C:\bacx, and
//  - use CMake 3.31.6, whose ninja (1.12+) honours Windows long-path support
//    (the default CMake 3.22.1 ships ninja 1.10, which doesn't).
// Both must be set as each project is configured (before AGP reads them),
// hence settings.gradle. EAS builds run on Linux and skip this.
const SNIPPET = `
${MARKER}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  gradle.lifecycle.beforeProject { p ->
    ['com.android.library', 'com.android.application'].each { id ->
      p.plugins.withId(id) {
        p.android.externalNativeBuild.cmake.version = '3.31.6'
        p.android.externalNativeBuild.cmake.buildStagingDirectory =
          new File('C:/bacx/' + Integer.toHexString(p.name.hashCode()))
      }
    }
  }
}
`;

module.exports = function withShortCmakePaths(config) {
  return withSettingsGradle(config, (c) => {
    if (!c.modResults.contents.includes(MARKER)) c.modResults.contents += SNIPPET;
    return c;
  });
};
