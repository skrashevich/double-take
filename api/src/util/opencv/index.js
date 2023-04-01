const { Canvas, Image, ImageData, loadImage } = require('@napi-rs/canvas');
const { OPENCV } = require('../../constants')();
const logger = require('../logger.util.js').init();
let isLoaded = false;

const installDOM = () => {
  global.Image = Image;
  global.Canvas = Canvas;
  global.ImageData = ImageData;
};

/**
 * Loads opencv.js.
 *
 * Installs HTML Canvas emulation to support `cv.imread()` and `cv.imshow`
 *
 * Mounts given local folder `localRootDir` in emscripten filesystem folder `rootDir`. By default it will mount the local current directory in emscripten `/work` directory. This means that `/work/foo.txt` will be resolved to the local file `./foo.txt`
 * @param {string} rootDir The directory in emscripten filesystem in which the local filesystem will be mount.
 * @param {string} localRootDir The local directory to mount in emscripten filesystem.
 * @returns {Promise} resolved when the library is ready to use.
 */
module.exports.load = (rootDir = '/work', localRootDir = process.cwd()) => {
  if (global.Module && global.Module.onRuntimeInitialized && global.cv && global.cv.imread) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    installDOM();
    global.Module = {
      onRuntimeInitialized() {
        global.cv.FS.chdir(rootDir);
        isLoaded = true;
        logger.verbose('opencv loaded');
        resolve();
      },
      preRun() {
        const { FS } = global.Module;
        if (!FS.analyzePath(rootDir).exists) {
          FS.mkdir(rootDir);
        }
        FS.mount(global.Module.FS.filesystems.NODEFS, { root: localRootDir }, rootDir);
      },
    };
    global.cv = require('./lib');
  });
};

module.exports.faceCount = async (path) => {
  try {
    if (!isLoaded) {
      console.warn('opencv not loaded yet');
      return;
    }
    const { cv } = global;
    const image = await loadImage(path);
    const src = cv.imread(image);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    const faces = new cv.RectVector();
    const faceCascade = new cv.CascadeClassifier();
    faceCascade.load('./api/src/util/opencv/haarcascade_frontalface_default.xml');
    faceCascade.detectMultiScale(
      gray,
      faces,
      OPENCV.SCALE_FACTOR,
      OPENCV.MIN_NEIGHBORS,
      0,
      new cv.Size(OPENCV.MIN_SIZE_WIDTH, OPENCV.MIN_SIZE_HEIGHT)
    );
    const faceCount = faces.size();
    src.delete();
    gray.delete();
    faceCascade.delete();
    faces.delete();
    return faceCount;
  } catch (error) {
    console.error(`opencv error: `, error.message || error);
    return 1;
  }
};

module.exports.shouldLoad = () => OPENCV || false;
