'use strict';

const { configureOtel, shutdownOtel } = require('./otel-setup');
const { logger, buildLogger } = require('./pino-setup');

module.exports = {
  configureOtel,
  shutdownOtel,
  logger,
  buildLogger,
};
