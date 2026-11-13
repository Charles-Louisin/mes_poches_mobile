// Web en développement : `npm run web:dev` active EXPO_WEB_SPA=1 et sert l'app en application monopage.
// Le rendu statique (web.output « static » de app.json) pré-rend chaque page côté serveur : en
// développement c'est très lent (page blanche qui tourne) et peut saturer la mémoire.
// Sans EXPO_WEB_SPA, la configuration de app.json est utilisée telle quelle (builds, export web).
module.exports = ({ config }) => {
  if (process.env.EXPO_WEB_SPA !== '1') return config;
  return { ...config, web: { ...config.web, output: 'single' } };
};
