// Permite trocar o caminho do export web (ex.: GitHub Pages) sem editar o app.json.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_BASE_URL ?? config.experiments?.baseUrl,
  },
});
