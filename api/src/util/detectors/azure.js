const fs = require('fs');
const { FaceClient } = require('@azure/cognitiveservices-face');
const { ApiKeyCredentials } = require('@azure/ms-rest-js');
const actions = require('./actions');
const { DETECTORS } = require('../../constants')();
const config = require('../../constants/config');

const { AZURE } = DETECTORS || {};

const CONFIGURED =
  ( AZURE?.KEY &&
    REKOGNITION?.PERSON_GROUP_ID &&
    REKOGNITION?.ENDPOINT ) ||
  false;

const faceClient = CONFIGURED ? 
    new FaceClient(
    new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': AZURE.KEY } }),
    AZURE.ENDPOINT
    ) : 
    {
        send: () => {
          throw new Error('azure not configured');
        },
      };

module.exports.recognize = async ({ key }) => {
  const detectedFaces = await faceClient.face.detectWithStream(fs.createReadStream(key));
  const faceIds = detectedFaces.map((face) => face.faceId);
  const identifiedFaces = await faceClient.face.identify(faceIds, AZURE.PERSON_GROUP_ID);
  return identifiedFaces;
};

module.exports.train = async ({ name, key }) => {
    const personGroup = await client.personGroup.get(AZURE.PERSON_GROUP_ID);
    let person;
    try {
      person = await client.person.get(personGroup.personGroupId, name);
    } catch (error) {
      person = await client.person.create(personGroup.personGroupId, name);
    }
    await client.person.addFaceFromStream(personGroup.personGroupId, person.personId, fs.createReadStream(key));
    return person;
  };

module.exports.remove = async ({ name }) => {
  const person = await faceClient.personGroupPerson.list(AZURE.PERSON_GROUP_ID).find((p) => p.name === name);

  if (person) {
    await faceClient.personGroupPerson.delete(AZURE.PERSON_GROUP_ID, person.personId);
  }
};

module.exports.normalize = ({ camera, data }) => {
    if (!data.length) {
      console.warn('unexpected azure data');
      return [];
    }
    const { MATCH, UNKNOWN } = config.detect(camera);
    const normalized = data.flatMap((result) => {
      const name = result.candidates.length ? result.candidates[0].personId.toLowerCase() : 'unknown';
      const confidence = result.candidates.length ? parseFloat((result.candidates[0].confidence * 100).toFixed(2)) : 0;
      const output = {
        name,
        confidence,
        match: name !== 'unknown' && confidence >= MATCH.CONFIDENCE,
        box: {
          top: result.faceRectangle.top,
          left: result.faceRectangle.left,
          width: result.faceRectangle.width,
          height: result.faceRectangle.height,
        },
      };
      const checks = actions.checks({ MATCH, UNKNOWN, ...output });
      if (checks.length) output.checks = checks;
      return checks !== false ? output : [];
    });
    return normalized;
  };
