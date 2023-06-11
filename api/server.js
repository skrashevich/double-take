#!/usr/bin/env bun

// eslint-disable-next-line import/no-import-module-exports
import * as http from 'node:http';

const logger = require('./src/util/logger.util').init();
const socket = require('./src/util/socket.util');
const { SERVER } = require('./src/constants')();
const { version } = require('./package.json');
const mqtt = require('./src/util/mqtt.util');
const storage = require('./src/util/storage.util');
const database = require('./src/util/db.util');
const config = require('./src/constants/config');
const shutdown = require('./src/util/shutdown.util');
const heartbeat = require('./src/util/heartbeat.util');
const validate = require('./src/schemas/validate');
//const opencv = require('./src/util/opencv');

async function start() {
  config.setup();
  storage.setup();
  console.log(`Double Take v${version}`);
  logger.verbose(config());
  validate(config());
  await database.init();
  console.log(`DB Initialized`);
  const server = new http.Server(require('./src/app')).listen(SERVER.PORT, async () => {
    logger.verbose(`api listening on :${SERVER.PORT}`);
  //  if (opencv.shouldLoad()) await opencv.load();
  });
  console.log(`HTTP Server Initialized`);
  mqtt.connect();
  storage.purge();
  socket.connect(server);
  heartbeat.cron();
}

module.exports = {
  start,
};

try {
  start().catch((error) => console.error(error));
  shutdown.listen();
} catch (error) {
  console.error(error);
}
