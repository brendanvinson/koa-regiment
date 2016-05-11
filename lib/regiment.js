'use strict';

const os = require('os');
const cluster = require('cluster');

const DEFAULT_DEADLINE_MS = 30000;

function makeWorker(workerFunc) {
  const server = workerFunc(cluster.worker.id);

  server.on('close', () => {
    process.exit();
  });

  process.on('SIGTERM', () => {
    server.close();
  });

  return server;
}

const regiment = (workerFunc, options) => {
  if (cluster.isWorker) return makeWorker(workerFunc);

  options = options || {};

  const numCpus = os.cpus().length;
  let running = true;

  const deadline = options.deadline || DEFAULT_DEADLINE_MS;
  const workers = options.workers || numCpus;
  const logger = options.logger || console;

  function ensureDeath(worker) {
    setTimeout(() => {
      logger.log(`Ensured death of ${worker.id}`);
      worker.kill();
    }, deadline).unref();
    worker.disconnect();
  }

  function kill(worker) {
    logger.log(`Killing ${worker.id}`);
    worker.process.kill();
    ensureDeath(worker);
  }

  function spawn() {
    const worker = cluster.fork();
    worker.on('message', messageHandler);
    return worker;
  }

  function fork() {
    for (let i = 0; i < workers; i++) {
      spawn();
    }
  }

  function respawn(worker) {
    if (running && !worker.exitedAfterDisconnect) {
      logger.log(`Respawning ${worker.id} after involuntary exit and disconnect`);
      spawn();
    }
  }

  function shutdown() {
    running = false;
    logger.log('Shutting down!');
    for (const id in cluster.workers) {
      if (cluster.hasOwnProperty(workers)) {
        kill(cluster.workers[id]);
      }
    }
  }

  function listen() {
    process
      .on('SIGINT', shutdown)
      .on('SIGTERM', shutdown);
    cluster.on('exit', respawn);
  }

  function messageHandler(msg) {
    if (running && msg.cmd && msg.cmd === 'need_replacement') {
      const workerId = msg.workerId;
      const replacement = spawn();
      logger.log(`Replacing worker ${workerId} with worker ${replacement.id}`);
      replacement.on('listening', () => {
        logger.log(`Replacement ${replacement.id} is listening, killing ${workerId}`);
        kill(cluster.workers[workerId]);
      });
    }
  }

  listen();
  fork();
};

regiment.middleware = require('./middleware');

module.exports = regiment;
