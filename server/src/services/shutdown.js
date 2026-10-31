function createShutdown({ server, closeSockets, closeWorkers, disconnectDatabase, timeoutMs = 30000 }) {
  let pending;
  return () => {
    if (pending) return pending;
    let timer;
    pending = Promise.race([
      (async () => {
        // Socket.IO closes upgraded connections; server.close alone does not.
        await closeSockets();
        if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await closeWorkers();
        await disconnectDatabase();
      })(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          server.closeAllConnections?.();
          reject(new Error('Graceful shutdown exceeded its deadline'));
        }, timeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
    return pending;
  };
}
module.exports = { createShutdown };
