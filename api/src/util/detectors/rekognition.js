const fs = require('fs');
const sizeOf = require('probe-image-size');
const https = require('https');
const aws4 = require('aws4');
const actions = require('./actions');
const database = require('../db.util');
const { DETECTORS } = require('../../constants')();
const config = require('../../constants/config');
const logger = require('../logger.util').init();
const { REKOGNITION } = DETECTORS || {};
let awsRequests = 0;

const CONFIGURED =
  (REKOGNITION?.AWS_REGION &&
    REKOGNITION?.AWS_ACCESS_KEY_ID &&
    REKOGNITION?.AWS_SECRET_ACCESS_KEY &&
    REKOGNITION?.COLLECTION_ID) ||
  false;

  const awsRequest = async (operation, payload) => {
    if (!CONFIGURED) throw new Error('rekognition not configured');
  
    const body = JSON.stringify({ ...payload, CollectionId: REKOGNITION.COLLECTION_ID });
    const options = {
      service: 'rekognition',
      region: REKOGNITION.AWS_REGION,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `RekognitionService.${operation}`,
      },
      body,
    };
  
    aws4.sign(options, {
      accessKeyId: REKOGNITION.AWS_ACCESS_KEY_ID,
      secretAccessKey: REKOGNITION.AWS_SECRET_ACCESS_KEY,
    });
  
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(JSON.parse(data));
        });
      });
  
      req.on('error', (error) => {
        reject(error);
      });
  
      req.write(body);
      req.end();
    });
  };

// Rekognition API functions
const createCollection = async () => awsRequest('CreateCollection', {});
const describeCollection = async () => awsRequest('DescribeCollection', {});
const deleteFaces = async ({ faceIds }) =>
  awsRequest('DeleteFaces', { FaceIds: faceIds });
const indexFaces = async ({ bytes }) =>
  awsRequest('IndexFaces', { Image: { Bytes: bytes.toString('base64') } });
const searchFacesByImage = async ({ faceMatchThreshold, bytes }) =>
  awsRequest('SearchFacesByImage', {
    FaceMatchThreshold: faceMatchThreshold,
    Image: { Bytes: bytes.toString('base64') },
  });

module.exports.recognize = async ({ key, test }) => {
  if (test) {
    if (!CONFIGURED) return { status: 500, data: 'rekognition not configured' };
    return { status: 200, data: { awsRequests, ...(await describeCollection()) } };
  }

  const { width, height } = await sizeOf(fs.createReadStream(key)).catch(() => ({
    width: 0,
    height: 0,
  }));

  logger.verbose('rekognition: recognize');
  awsRequests += 1;
  return {
    data: {
      ...(await searchFacesByImage({
        bytes: fs.readFileSync(key),
      })),
      source: { width, height },
    },
  };
};

module.exports.train = async ({ key }) => {
  logger.verbose('rekognition: index');
  awsRequests += 1;
  return {
    data: { ...(await indexFaces({ bytes: fs.readFileSync(key) })) },
  };
};

module.exports.remove = ({ ids = [] }) => {
  logger.verbose('rekognition: delete faces');
  awsRequests += 1;
  const db = database.connect();
  const faceIds = !ids.length
    ? db
        .prepare(
          `SELECT name, json_extract(value, '$.Face.FaceId') faceId
          FROM train, json_each(json_extract(meta, '$.FaceRecords'))`
        )
        .all()
        .map((obj) => obj.faceId)
    : db
        .prepare(
          `SELECT name, json_extract(value, '$.Face.FaceId') faceId
          FROM train, json_each(json_extract(meta, '$.FaceRecords'))
          WHERE fileId IN (${database.params(ids)})`
        )
        .all(ids)
        .map((obj) => obj.faceId);

  if (faceIds.length) return deleteFaces({ faceIds });
};

module.exports.normalize = ({ camera, data }) => {
  if (data?.$metadata?.httpStatusCode !== 200 && !data?.error?.includes('no faces'))
    throw new Error(data.error);
  const { MATCH, UNKNOWN } = config.detect(camera);
  const normalized = (data.FaceMatches || []).map((obj) => {
    const confidence = parseFloat(obj.Similarity.toFixed(2));
    const { /* BoundingBox: box, */ FaceId } = obj.Face;
    const db = database.connect();
    const [match] = db
      .prepare(
        `SELECT name, json_extract(value, '$.Face.FaceId') faceId
        FROM train, json_each(json_extract(meta, '$.FaceRecords'))
        WHERE faceId = :faceId
        LIMIT 1`
      )
      .bind({ faceId: FaceId })
      .all();
    const output = {
      name: match.name.toLowerCase(),
      confidence,
      match:
        match &&
        confidence >= MATCH.CONFIDENCE &&
        data.SearchedFaceBoundingBox.Width *
          data.source.width *
          (data.SearchedFaceBoundingBox.Height * data.source.height) >=
          MATCH.MIN_AREA,
      box: {
        top: parseInt(data.SearchedFaceBoundingBox.Top * data.source.height, 10),
        left: parseInt(data.SearchedFaceBoundingBox.Left * data.source.width, 10),
        width: parseInt(data.SearchedFaceBoundingBox.Width * data.source.width, 10),
        height: parseInt(data.SearchedFaceBoundingBox.Height * data.source.height, 10),
      },
    };
    const checks = actions.checks({ MATCH, UNKNOWN, ...output });
    if (checks.length) output.checks = checks;
    return checks !== false ? output : [];
  });

  if (!normalized.length && data.SearchedFaceBoundingBox) {
    normalized.push({
      name: 'unknown',
      confidence: null,
      match: false,
      box: {
        top: parseInt(data.SearchedFaceBoundingBox.Top * data.source.height, 10),
        left: parseInt(data.SearchedFaceBoundingBox.Left * data.source.width, 10),
        width: parseInt(data.SearchedFaceBoundingBox.Width * data.source.width, 10),
        height: parseInt(data.SearchedFaceBoundingBox.Height * data.source.height, 10),
      },
    });
  }

  let noDups = [];
  normalized.forEach((face) => {
    if (!noDups.find((obj) => obj.name === face.name)) noDups.push(face);
  });
  noDups = noDups.map((obj) => ({
    ...obj,
    name: obj.confidence >= UNKNOWN.CONFIDENCE ? obj.name : 'unknown',
  }));

  return noDups;
};

if (CONFIGURED) {
  (async () => {
    await describeCollection().catch(async (error) => {
      if (error.name === 'ResourceNotFoundException') await createCollection();
      else console.error(error);
    });
  })();
}
