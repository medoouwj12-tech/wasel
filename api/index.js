// Route all API requests through one Vercel function while preserving the
// original Express URL (Vercel function files otherwise map to fixed paths).
const app = require('../server/index');

module.exports = (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = url.searchParams.get('__route') || '';
  url.searchParams.delete('__route');

  const query = url.searchParams.toString();
  req.url = `/api${route ? `/${route.replace(/^\/+/, '')}` : ''}${query ? `?${query}` : ''}`;
  return app(req, res);
};
