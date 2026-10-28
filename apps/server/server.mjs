// Small cross-platform launcher for the y-websocket server.
// Environment defaults can be overridden by Docker Compose or the shell.
process.env.HOST ??= '0.0.0.0';
process.env.PORT ??= '1234';
process.env.YPERSISTENCE ??= './yjs-data';

await import('y-websocket/bin/server.js');
