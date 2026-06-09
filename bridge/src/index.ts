import { createHttpServer } from './httpServer.js';
import { MCPClient } from './mcpClient.js';
import { Registry } from './registry.js';

function parseArgs(): { port: number } {
  const args = process.argv.slice(2);
  let port = 7777;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--port' || args[i] === '-p') && i + 1 < args.length) {
      port = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { port };
}

function main(): void {
  const { port } = parseArgs();

  const client = new MCPClient();
  const registry = new Registry(client);
  const server = createHttpServer(registry, port);

  function shutdown() {
    console.log('\nShutting down...');
    server.close(() => {
      registry.stopAll();
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Forced shutdown');
      process.exit(1);
    }, 5000).unref();
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(port, () => {
    console.log(`MCP Bridge running on http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
  });
}

main();
