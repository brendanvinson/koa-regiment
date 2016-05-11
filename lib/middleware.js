'use strict';

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
    let numRequests = 0;
    let dying = false;

    return function limitRequestCount(ctx, next) {
      numRequests = numRequests + 1;
      return next().then(() => {
        if (!dying && numRequests >= maxRequests) {
          dying = true;
          gracefullyDie(ctx.req.socket.server, `Request count limit of ${maxRequests} reached!`);
        }
      });
    };
  },

  MemoryFootprint: (maxRssMb) => {
    let dying = false;

    return function limitMemoryFootprint(ctx, next) {
      const currentRss = process.memoryUsage().rss / (1024 * 1024);
      return next().then(() => {
        if (!dying && currentRss >= maxRssMb) {
          dying = true;
          gracefullyDie(ctx.req.socket.server, `Memory footprimit limit of ${maxRssMb} reached!`);
        }
      });
    };
  }
};
