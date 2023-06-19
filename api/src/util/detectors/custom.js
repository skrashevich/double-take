const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const actions = require('./actions');
const { DETECTORS } = require('../../constants')();
const config = require('../../constants/config');

const { CUSTOM } = DETECTORS || {};

module.exports.recognize = async ({ key, url, responseFields }) => {
  const { KEY } = CUSTOM;
  const formData = new FormData();
  formData.append('image', fs.createReadStream(key));
  if (KEY) formData.append('api_key', KEY);
  return axios({
    method: 'post',
    timeout: CUSTOM.TIMEOUT * 1000,
    headers: {
      ...formData.getHeaders(),
    },
    url: `${url}/v1/vision/face/recognize`,
    validateStatus() {
      return true;
    },
    data: formData,
  }).then((response) => {
    return responseFields.reduce((obj, field) => {
      obj[field] = response.data[field];
      return obj;
    }, {});
  });
};

// Similar modifications can be made to the train and remove functions

module.exports.normalize = ({ camera, data, responseFields }) => {
  if (!data.success) {
    console.warn('unexpected custom detector data');
    return [];
  }
  const { MATCH, UNKNOWN } = config.detect(camera);
  if (!data.predictions) {
    console.warn('unexpected custom detector predictions data');
    return [];
  }
  const normalized = data.predictions.flatMap((obj) => {
    const confidence = parseFloat((obj[responseFields.confidence] * 100).toFixed(2));
    const output = {
      name: confidence >= UNKNOWN.CONFIDENCE ? obj[responseFields.userid].toLowerCase() : 'unknown',
      confidence,
      match:
        obj[responseFields.userid] !== 'unknown' &&
        confidence >= MATCH.CONFIDENCE &&
        (obj[responseFields.x_max] - obj[responseFields.x_min]) *
          (obj[responseFields.y_max] - obj[responseFields.y_min]) >=
          MATCH.MIN_AREA,
      box: {
        top: obj[responseFields.y_min],
        left: obj[responseFields.x_min],
        width: obj[responseFields.x_max] - obj[responseFields.x_min],
        height: obj[responseFields.y_max] - obj[responseFields.y_min],
      },
    };
    const checks = actions.checks({ MATCH, UNKNOWN, ...output });
    if (checks.length) output.checks = checks;
    return checks !== false ? output : [];
  });
  return normalized;
};
