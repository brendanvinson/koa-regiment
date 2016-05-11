const cluster = require('cluster');

function gracefullyDie(server, reason) {
  process.send({
    cmd: 'need_replacement',
    workerId: cluster.worker.id,
    reason
  });
}

module.exports = {
  RequestCount: (maxRequests) => {
    let requestCount = 0;
    let dying = false;

    return (ctx, next) => {
      requestCount = requestCount + 1;

      if (!dying && requestCount >= maxRequests) {
        dying = true;
        gracefullyDie(ctx.req.socket.server, `Request count limit of ${maxRequests} reached!`);
      }

      next();
    };
  },

  MemoryFootprint: (maxRssMb) => {
    let dying = false;

    return (ctx, next) => {
      const currentRss = process.memoryUsage().rss / (1024 * 1024);

      if (!dying && currentRss >= maxRssMb) {
        dying = true;
        gracefullyDie(ctx.req.socket.server, `Memory footprimit limit of ${maxRssMb} reached!`);
      }

      next();
    };
  }
};
