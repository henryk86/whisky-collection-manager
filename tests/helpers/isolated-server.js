/**
 * Entry point used only by integration tests. The OS binds an ephemeral port
 * atomically; unlike probing and releasing a "free" port, no other test
 * process can acquire this address before our server starts listening.
 *
 * Production startup and its explicit PORT configuration are not affected.
 */
import {createServer} from '../../server/app.js';

const server = createServer();
server.on('error', error => {
  console.error('Isolated test server failed:', error);
  process.exitCode = 1;
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string' || !process.send) {
    console.error('Isolated test server requires an IPC channel and a TCP port.');
    server.close();
    process.exitCode = 1;
    return;
  }
  process.send({type: 'test-server-ready', port: address.port});
});
