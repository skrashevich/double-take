const fs = require('fs');
const axios = require('axios');
const sizeOf = require('probe-image-size');
const { createCanvas, loadImage, registerFont } = require('canvas');
const sanitize = require('sanitize-filename-truncate');
const { jwt } = require('../util/auth.util');
const filesystem = require('../util/fs.util');
const database = require('../util/db.util');
const { tryParseJSON } = require('../util/validators.util');
const { BAD_REQUEST } = require('../constants/http-status');
const { AUTH, SERVER, UI } = require('../constants')();
const { PATH } = require('../constants')().STORAGE.MEDIA;
const { QUALITY, WIDTH } = require('../constants')().UI.THUMBNAILS;

module.exports.matches = async (req, res) => {
  const { box: showBox } = req.query;
  let { filename } = req.params;
  filename = sanitize(filename);

  const source = `${PATH}/matches/${filename}`;

  if (!filename) {
    return res.status(BAD_REQUEST).error(`Invalid filename provided`);
  }

  if (!fs.existsSync(source)) {
    return res.status(BAD_REQUEST).error(`${source} does not exist`);
  }

  if (showBox === 'true') {
    const db = database.connect();
    const match = db.prepare('SELECT * FROM match WHERE filename = ?').bind(filename).get();

    if (!match || !tryParseJSON(match.response)) {
      const buffer = fs.readFileSync(source);
      res.set('Content-Type', 'image/jpeg');
      return res.end(buffer);
    }
    const response = JSON.parse(match.response);

    const fontSize = 18;
    const textPadding = 10;
    const lineWidth = 4;

    const { width, height } = await sizeOf(fs.createReadStream(source)).catch((/* error */) => ({
      width: 0,
      height: 0,
    }));
    if (width <= 0 || height <= 0) {
      return res.status(BAD_REQUEST).error(`Invalid image dimensions for ${source}`);
    }
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const image = await loadImage(source);

    registerFont(`${__dirname}/../static/fonts/Roboto/Roboto-Medium.ttf`, {
      family: 'Roboto-Medium',
    });
    ctx.drawImage(image, 0, 0);
    ctx.font = `${fontSize}px Roboto-Medium`;
    ctx.textBaseline = 'top';

    const textHeight = fontSize + textPadding;

    response.forEach((obj) => {
      const { detector } = obj;
      obj.results.forEach(({ name, confidence, box }) => {
        const text = `${name} - ${confidence}%`;
        const textWidth = ctx.measureText(text).width + textPadding;

        let fillStyle = '#78cc86'; // default color
        let textColor = '#000'; // default text color for contrast

        if (detector === 'compreface') {
          fillStyle = '#095fd7';
          textColor = '#fff'; // White text for contrast against dark blue
        }
        if (detector === 'deepstack') {
          fillStyle = '#d66b11';
          textColor = '#fff'; // White text for contrast against dark orange
        }
        if (detector === 'aiserver') {
          fillStyle = '#f9fc97';
          textColor = '#000'; // Black text for contrast against light yellow
        }
        if (detector === 'facebox') {
          fillStyle = '#5f39a4';
          textColor = '#fff'; // White text for contrast against dark purple
        }

        ctx.fillStyle = fillStyle;
        if (confidence > 0) {
          ctx.fillRect(box.left - lineWidth / 2, box.top - textHeight, textWidth, textHeight);

          ctx.fillStyle = textColor;

          ctx.fillText(
            text,
            box.left + textPadding / 2 - lineWidth / 2,
            box.top - textHeight + textPadding / 2
          );
        }

        ctx.strokeStyle = fillStyle;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        ctx.rect(box.left, box.top, box.width, box.height);
        ctx.stroke();
      });
    });

    const lastModified = filesystem.getLastModified(source);
    res.set('Cache-Control', 'public, max-age=604800'); // 1 week
    res.set('Last-Modified', lastModified);

    const buffer = canvas.toBuffer('image/jpeg');
    res.set('Content-Type', 'image/jpeg');
    return res.end(buffer);
  }
  const image = await loadImage(source);
  let buffer;
  if (req.query.thumb === '') {
    if (WIDTH <= 0 || image.height * (WIDTH / image.width) <= 0) {
      return res.status(BAD_REQUEST).error(`Invalid image dimensions for ${source}`);
    }
    const canvas = createCanvas(WIDTH, image.height * (WIDTH / image.width));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Note: The quality of the JPEG can't be set using Node.js canvas, it will always be maximum quality.
    // This might cause the output image to be larger than expected.
    buffer = canvas.toBuffer('image/jpeg', { quality: QUALITY });
  } else {
    buffer = fs.readFileSync(source);
  }
  res.set('Content-Type', 'image/jpeg');
  const lastModified = filesystem.getLastModified(source);
  res.set('Cache-Control', 'public, max-age=604800'); // 1 week
  res.set('Last-Modified', lastModified);
  return res.end(buffer);
};

module.exports.train = async (req, res) => {
  const { name, filename } = req.params;
  const source = `${PATH}/train/${name}/${filename}`;

  if (!fs.existsSync(source)) return res.status(BAD_REQUEST).error(`${source} does not exist`);

  const image = await loadImage(source);
  let buffer;
  if (req.query.thumb === '') {
    if (WIDTH <= 0 || image.height * (WIDTH / image.width) <= 0) {
      return res.status(BAD_REQUEST).error(`Invalid image dimensions for ${source}`);
    }
    const canvas = createCanvas(WIDTH, image.height * (WIDTH / image.width));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Note: The quality of the JPEG can't be set using Node.js canvas, it will always be maximum quality.
    // This might cause the output image to be larger than expected.
    buffer = canvas.toBuffer('image/jpeg');
  } else {
    buffer = fs.readFileSync(source);
  }

  res.set('Content-Type', 'image/jpeg');
  return res.end(buffer);
};

module.exports.delete = async (req, res) => {
  const { files } = req.body;
  if (files && files.length) {
    const db = database.connect();
    db.prepare(
      `DELETE FROM file WHERE id IN (${files.map((obj) => `'${obj.id}'`).join(',')})`
    ).run();
    db.prepare(
      `DELETE FROM train WHERE fileId IN (${files.map((obj) => `'${obj.id}'`).join(',')})`
    ).run();
    files.forEach((obj) => {
      filesystem.delete(`${PATH}/${obj.key}`);
    });
  }
  res.send({ success: true });
};

module.exports.latest = async (req, res) => {
  const { filename } = req.params;
  const { box } = req.query;
  const name = filename.replace('.jpg', '');
  const source = `${PATH}/latest/${filename}`;

  if (!fs.existsSync(source)) return res.status(BAD_REQUEST).error(`${source} does not exist`);

  const db = database.connect();
  const [nameMatch] = db
    .prepare(
      `SELECT t.id, filename, value FROM (
          SELECT match.id, filename, json_extract(value, '$.results') results
          FROM match, json_each( match.response)
          ) t, json_each(t.results)
        WHERE json_extract(value, '$.name') IN (${database.params([name])})
        GROUP BY t.id
        ORDER BY t.id DESC
        LIMIT 1`
    )
    .all(name);

  const [cameraMatch] = db
    .prepare(
      `SELECT t.id, t.event, filename, value FROM (
          SELECT match.id, event, filename, json_extract(value, '$.results') results
          FROM match, json_each( match.response)
          ) t, json_each(t.results)
        WHERE json_extract(t.event, '$.camera') IN (${database.params([name])})
        GROUP BY t.id
        ORDER BY t.id DESC
        LIMIT 1`
    )
    .all(name);

  if ((!nameMatch && !cameraMatch) || box !== 'true') {
    res.set('Content-Type', 'image/jpeg');
    return res.end(fs.readFileSync(source));
  }

  const { filename: originalFilename } = nameMatch || cameraMatch;

  const request = await axios({
    method: 'get',
    url: `http://${SERVER.HOST}:${SERVER.PORT}${UI.PATH}/api/storage/matches/${originalFilename}?box=true`,
    headers: AUTH ? { authorization: jwt.sign({ route: 'storage' }) } : null,
    responseType: 'arraybuffer',
  });

  res.set('Content-Type', 'image/jpeg');
  res.end(request.data);
};
