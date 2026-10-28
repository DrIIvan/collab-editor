const url = process.argv[2] ?? 'ws://127.0.0.1:8081/ws/ci-smoke';

if (typeof WebSocket === 'undefined') {
  console.error('This smoke test requires Node.js 22 or newer (global WebSocket).');
  process.exit(2);
}

const socket = new WebSocket(url);

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    socket.close();
    reject(new Error(`Timed out connecting to ${url}`));
  }, 5000);

  socket.addEventListener('open', () => {
    clearTimeout(timeout);
    socket.close();
    resolve();
  }, { once: true });

  socket.addEventListener('error', () => {
    clearTimeout(timeout);
    reject(new Error(`WebSocket connection failed: ${url}`));
  }, { once: true });
});

console.log(`WebSocket handshake OK: ${url}`);
