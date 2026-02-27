/**
 * WeChat Cloud wrapper — typed helpers around wx.cloud.* APIs.
 *
 * Cloud environment ID: update CLOUD_ENV to match your WeChat Cloud console env.
 * Create your cloud environment at: https://console.cloud.weixin.qq.com/
 */

export const CLOUD_ENV = 'cloudbase-2gx259up8418cc2b';

let _initialized = false;

export function initCloud() {
  if (_initialized) return;
  wx.cloud.init({
    env: CLOUD_ENV,
    traceUser: true,
  });
  _initialized = true;
}

/** Call a cloud function. Returns result.result. */
export async function callFunction(name, data = {}) {
  const res = await wx.cloud.callFunction({ name, data });
  if (res.errMsg && res.errMsg !== `${name}:ok`) {
    throw new Error(`Cloud function ${name} failed: ${res.errMsg}`);
  }
  return res.result;
}

/** Get a reference to the cloud database. */
export function db() {
  return wx.cloud.database({ env: CLOUD_ENV });
}

/** Upload a file to cloud storage. Returns { fileID, tempFileURL }. */
export async function uploadFile(cloudPath, filePath) {
  const res = await wx.cloud.uploadFile({ cloudPath, filePath });
  return res;
}

/** Get a temporary download URL for a cloud file. */
export async function getTempFileURL(fileID) {
  const res = await wx.cloud.getTempFileURL({ fileList: [fileID] });
  return res.fileList[0]?.tempFileURL;
}

// ── Convenience DB helpers ────────────────────────────────────────────────────

export const DB = {
  /** Get a single document by collection + id. */
  async get(collection, id) {
    const snap = await db().collection(collection).doc(id).get();
    return snap.data;
  },

  /** Query documents. filterFn receives a db.command object. */
  async query(collection, where = {}) {
    let ref = db().collection(collection);
    if (Object.keys(where).length > 0) ref = ref.where(where);
    const snap = await ref.get();
    return snap.data;
  },

  /** Set (overwrite) a document. */
  async set(collection, id, data) {
    return db().collection(collection).doc(id).set({ data });
  },

  /** Update (merge) a document. */
  async update(collection, id, data) {
    return db().collection(collection).doc(id).update({ data });
  },

  /** Add a new document (auto-id). */
  async add(collection, data) {
    return db().collection(collection).add({ data });
  },

  /** Watch a document for real-time updates. Returns a watcher handle. */
  watch(collection, id, onChange, onError) {
    return db().collection(collection).doc(id).watch({
      onChange,
      onError,
    });
  },
};
