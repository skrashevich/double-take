const { UI } = require('../constants')();


let wss = null;

module.exports.connect = (server) => {
  wss = Bun.serve({
    fetch(req, server) {}, // upgrade logic
    websocket: {
      message(ws, message) {
        console.log('Received:', message);
      }, // a message is received
      open(ws) {
        console.log('Client connected');
      }, // a socket is opened
      close(ws, code, message) {
        console.log('Client disconnected');
      }, // a socket is closed
      drain(ws) {}, // the socket is ready to receive more data
    },
  });
};

module.exports.emit = (event, message) => {
  wss.send(String(recognize)+String(message))
};
