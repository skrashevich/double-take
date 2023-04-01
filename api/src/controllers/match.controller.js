const fs = require('fs');
const sizeOf = require('probe-image-size');
const database = require('../util/db.util');
const filesystem = require('../util/fs.util');
const { tryParseJSON } = require('../util/validators.util');
const { jwt } = require('../util/auth.util');
const process = require('../util/process.util');
const { AUTH, STORAGE, UI } = require('../constants')();
const { BAD_REQUEST } = require('../constants/http-status');
const DETECTORS = require('../constants/config').detectors();

const format = async (matches) => {
  const token = AUTH && matches.length ? jwt.sign({ route: 'storage' }) : null;
  matches = await Promise.all(
    matches.map(async (obj) => {
      const { id, filename, event, response, isTrained } = obj;
      const { camera, type, zones, updatedAt } = JSON.parse(event);
      const key = `matches/${filename}`;
      const { width, height } = await sizeOf(
        fs.createReadStream(`${STORAGE.MEDIA.PATH}/${key}`)
      ).catch((/* error */) => ({ width: 0, height: 0 }));

      return {
        id,
        camera,
        type,
        zones,
        file: {
          key,
          filename,
          width,
          height,
        },
        isTrained: !!isTrained,
        response: JSON.parse(response),
        createdAt: obj.createdAt,
        updatedAt: updatedAt || null,
        token,
      };
    })
  );
  return matches;
};

module.exports.get = async (req, res) => {
  const limit = UI.PAGINATION.LIMIT;
  const { sinceId, page } = req.query;
  const filters = tryParseJSON(req.query.filters);

  const db = database.connect();

  if (!filters || !Object.keys(filters).length) {
    const [total] = db.query(`SELECT COUNT(*) count FROM match`).all();
    const matches = db
      .query(
        `SELECT * FROM match
          LEFT JOIN (SELECT filename as isTrained FROM train GROUP BY filename) train ON train.isTrained = match.filename
          ORDER BY createdAt DESC
          LIMIT ?1,?2`
      )
      .all(limit * (page - 1), limit)

    return res.send({ total: total.count, limit, matches: await format(matches) });
  }

  const confidenceQuery =
    filters.confidence === 0 ? `OR json_extract(value, '$.confidence') IS NULL` : '';

  const filteredIds = db
    .query(
      `SELECT t.id, t.event, detector, value FROM (
          SELECT match.id, event, json_extract(value, '$.detector') detector, json_extract(value, '$.results') results
          FROM match, json_each( match.response)
          ) t, json_each(t.results)
        WHERE json_extract(value, '$.name') IN (?1)
        AND json_extract(value, '$.match') IN (?2)
        AND json_extract(t.event, '$.camera') IN (?3)
        AND json_extract(t.event, '$.type') IN (?4)
        AND (json_extract(value, '$.confidence') >= ?5 ${confidenceQuery})
        AND json_extract(value, '$.box.width') >= ?6
        AND json_extract(value, '$.box.height') >= ?7
        AND detector IN (?8)
        GROUP BY t.id`
    )
    .all(
      filters.names,
      filters.matches.map((obj) => (obj === 'match' ? 1 : 0)),
      filters.cameras,
      filters.types,
      filters.confidence,
      filters.width,
      filters.height,
      filters.detectors
    )
    .map((obj) => obj.id);

  const [total] = db
    .query(
      `SELECT COUNT(*) count FROM match
      WHERE id IN (?1)
      AND id > ?2
      ORDER BY createdAt DESC`
    )
    .all(filteredIds, sinceId || 0);

  const matches = db
    .query(
      `SELECT * FROM match
        LEFT JOIN (SELECT filename as isTrained FROM train GROUP BY filename) train ON train.isTrained = match.filename
        WHERE id IN (?1)
        AND id > ?2
        ORDER BY createdAt DESC
        LIMIT ?3,?4`
    )
    .all(Number(filteredIds), Number(sinceId || 0), Number(limit * (page - 1)), Number(limit));

  res.send({ total: total.count, limit, matches: await format(matches) });
};

module.exports.delete = async (req, res) => {
  const { ids } = req.body;
  if (ids.length) {
    const db = database.connect();
    const files = db
      .query(`SELECT filename FROM match WHERE id IN (?1)`)
      .all(ids);

    db.query(`DELETE FROM match WHERE id IN (?1)`).run(ids);

    files.forEach(({ filename }) => {
      filesystem.delete(`${STORAGE.MEDIA.PATH}/matches/${filename}`);
    });
  }

  res.send({ success: true });
};

module.exports.reprocess = async (req, res) => {
  const { matchId } = req.params;
  if (!DETECTORS.length) return res.status(BAD_REQUEST).error('no detectors configured');

  const db = database.connect();
  let [match] = db.query('SELECT * FROM match WHERE id = ?1').all(Number(matchId));

  if (!match) return res.status(BAD_REQUEST).error('No match found');

  const results = await process.start({
    camera: tryParseJSON(match.event) ? tryParseJSON(match.event).camera : null,
    filename: match.filename,
    tmp: `${STORAGE.MEDIA.PATH}/matches/${match.filename}`,
  });
  database.update.match({
    id: match.id,
    event: JSON.parse(match.event),
    response: results,
  });
  match = db
    .query(
      `SELECT * FROM match
      LEFT JOIN (SELECT filename as isTrained FROM train GROUP BY filename) train ON train.isTrained = match.filename
      WHERE id = ?1`
    )
    .all(Number(matchId));
  [match] = await format(match);

  res.send(match);
};

module.exports.filters = async (req, res) => {
  const db = database.connect();

  const [total] = db.query('SELECT COUNT(*) count FROM match').all();

  const detectors = db
    .query(
      `SELECT json_extract(value, '$.detector') name
        FROM match, json_each(match.response)
        GROUP BY name
        ORDER BY name ASC`
    )
    .all()
    .map((obj) => obj.name);

  const names = db
    .query(
      `SELECT json_extract(value, '$.name') name FROM (
          SELECT json_extract(value, '$.results') results
          FROM match, json_each(match.response)
          ) t, json_each(t.results)
        GROUP BY name
        ORDER BY name ASC`
    )
    .all()
    .map((obj) => obj.name);

  const matches = db
    .query(
      `SELECT IIF(json_extract(value, '$.match') == 1, 'match', 'miss') name FROM (
          SELECT json_extract(value, '$.results') results
          FROM match, json_each(match.response)
          ) t, json_each(t.results)
        GROUP BY name
        ORDER BY name ASC`
    )
    .all()
    .map((obj) => obj.name);

  const cameras = db
    .query(
      `SELECT json_extract(event, '$.camera') name
      FROM match
      GROUP BY name
      ORDER BY name ASC`
    )
    .all()
    .map((obj) => obj.name);

  const types = db
    .query(
      `SELECT json_extract(event, '$.type') name
      FROM match
      GROUP BY name
      ORDER BY name ASC`
    )
    .all()
    .map((obj) => obj.name);

  res.send({ total: total.count, detectors, names, matches, cameras, types });
};
