// Local development builds (APP_VARIANT=development) get their own app id and
// name, so they install next to the release build instead of replacing it.
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? 'Better Alarms (dev)' : config.name,
  android: {
    ...config.android,
    package: IS_DEV ? 'com.betteralarms.app.dev' : config.android.package,
  },
});
