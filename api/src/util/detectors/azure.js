const fs = require('fs');
const sizeOf = require('probe-image-size');
const axios = require('axios');
const actions = require('./actions');
const database = require('../db.util');
const { DETECTORS } = require('../../constants')();
const config = require('../../constants/config');

const { AZURE_FACE_API } = DETECTORS || {};
let azureRequests = 0;

const CONFIGURED =
    (AZURE_FACE_API?.ENDPOINT && AZURE_FACE_API?.SUBSCRIPTION_KEY && AZURE_FACE_API?.PERSON_GROUP_ID) ||
    false;

const headers = {
    'Content-Type': 'application/octet-stream',
    'Ocp-Apim-Subscription-Key': AZURE_FACE_API.SUBSCRIPTION_KEY,
};

const createPersonGroup = async () =>
    axios.put(`${AZURE_FACE_API.ENDPOINT}/persongroups/${AZURE_FACE_API.PERSON_GROUP_ID}`, {
        name: AZURE_FACE_API.PERSON_GROUP_ID,
    });

const deletePerson = async (personId) =>
    axios.delete(`${AZURE_FACE_API.ENDPOINT}/persongroups/${AZURE_FACE_API.PERSON_GROUP_ID}/persons/${personId}`);

const createPerson = async (name) =>
    axios.post(`${AZURE_FACE_API.ENDPOINT}/persongroups/${AZURE_FACE_API.PERSON_GROUP_ID}/persons`, {
        name,
    });

const addPersonFace = async (personId, imgBytes) =>
    axios.post(`${AZURE_FACE_API.ENDPOINT}/persongroups/${AZURE_FACE_API.PERSON_GROUP_ID}/persons/${personId}/persistedfaces`, imgBytes, {
        headers,
    });

const trainPersonGroup = async () =>
    axios.post(`${AZURE_FACE_API.ENDPOINT}/persongroups/${AZURE_FACE_API.PERSON_GROUP_ID}/train`);

const detectFace = async (imgBytes) =>
    axios.post(`${AZURE_FACE_API.ENDPOINT}/detect`, imgBytes, {
        headers,
        params: {
            returnFaceId: true,
            returnFaceLandmarks: false,
            returnFaceAttributes: 'emotion',
        },
    });

const identifyFace = async (faceIds) =>
    axios.post(`${AZURE_FACE_API.ENDPOINT}/identify`, {
        personGroupId: AZURE_FACE_API.PERSON_GROUP_ID,
        faceIds,
    });

module.exports.recognize = async ({ key, test }) => {
    if (test) {
        if (!CONFIGURED) return { status: 500, data: 'Azure Face API not configured' };
        return { status: 200, data: { azureRequests } };
    }

    const { width, height } = await sizeOf(fs.createReadStream(key)).catch(() => ({
        width: 0,
        height: 0,
    }));

    console.verbose('Azure Face API: recognize');
    azureRequests += 1;
    const imgBytes = fs.readFileSync(key);
    const detectResponse = await detectFace(imgBytes);
    const faceIds = detectResponse.data.map((face) => face.faceId);
    const identifyResponse = await identifyFace(faceIds);
    return {
        data: {
            ...identifyResponse,
            source: { width, height },
        },
    };
};

module.exports.train = async ({ key, name }) => {
    console.verbose('Azure Face API: train');
    azureRequests += 1;
    const imgBytes = fs.readFileSync(key);
    const createPersonResponse = await createPerson(name);
    const personId = createPersonResponse.data.data.personId;
    await addPersonFace(personId, imgBytes);
    await trainPersonGroup();
    return {
        data: { personId },
    };
};

module.exports.remove = async ({ personIds = [] }) => {
    console.verbose('Azure Face API: delete persons');
    azureRequests += 1;

    if (personIds.length) {
        for (const personId of personIds) {
            await deletePerson(personId);
        }
    }
};

module.exports.normalize = ({ camera, data }) => {
    if (data?.status !== 200 && !data?.error?.includes('no faces')) throw new Error(data.error);

    const { MATCH, UNKNOWN } = config.detect(camera);
    const normalized = (data.data || []).map((obj) => {
        const confidence = parseFloat(obj.confidence.toFixed(2));
        const { /* BoundingBox: box, */ personId } = obj.candidates[0] || {};
        const db = database.connect();
        const [match] = db
            .prepare(
                SELECT name, personId FROM train WHERE personId = : personId LIMIT 1
            )
            .bind({ personId })
            .all();
        const output = {
            name: match.name.toLowerCase(),
            confidence,
            match:
                match &&
                confidence >= MATCH.CONFIDENCE &&
                data.faceRectangle.width *
                data.source.width *
                (data.faceRectangle.height * data.source.height) >=
                MATCH.MIN_AREA,
            box: {
                top: parseInt(data.faceRectangle.top * data.source.height, 10),
                left: parseInt(data.faceRectangle.left * data.source.width, 10),
                width: parseInt(data.faceRectangle.width * data.source.width, 10),
                height: parseInt(data.faceRectangle.height * data.source.height, 10),
            },
        };
        const checks = actions.checks({ MATCH, UNKNOWN, ...output });
        if (checks.length) output.checks = checks;
        return checks !== false ? output : [];
    });

    if (!normalized.length && data.faceRectangle) {
        normalized.push({
            name: 'unknown',
            confidence: null,
            match: false,
            box: {
                top: parseInt(data.faceRectangle.top * data.source.height, 10),
                left: parseInt(data.faceRectangle.left * data.source.width, 10),
                width: parseInt(data.faceRectangle.width * data.source.width, 10),
                height: parseInt(data.faceRectangle.height * data.source.height, 10),
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
        try {
            await createPersonGroup();
        } catch (error) {
            if (error.response?.status !== 409) console.error(error);
        }
    })();
}