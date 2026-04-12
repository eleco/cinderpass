// Provide a DATABASE_URL so requireDatabaseUrl() passes in all route tests.
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
