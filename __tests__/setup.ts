// Provide Redis credentials so requireStore() passes in all route tests.
process.env.KV_REST_API_URL ??= 'http://localhost:8079';
process.env.KV_REST_API_TOKEN ??= 'test-token';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
