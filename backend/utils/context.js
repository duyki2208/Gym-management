/**
 * backend/utils/context.js
 * Multi-Branch Request Context & Model Dynamic Proxy (Node.js AsyncLocalStorage)
 *
 * Cho phép các Controller và Helper tự động truy cập đúng Database Connection của
 * Chi nhánh hiện tại trong từng request song song mà không sợ xung đột race condition.
 */
const { AsyncLocalStorage } = require("node:async_hooks");

const asyncLocalStorage = new AsyncLocalStorage();

const runWithContext = (context, callback) => {
  return asyncLocalStorage.run(context, callback);
};

const getContext = () => {
  return asyncLocalStorage.getStore();
};

const getModel = (modelName, defaultModel) => {
  const store = asyncLocalStorage.getStore();
  if (store && store.models && store.models[modelName]) {
    return store.models[modelName];
  }
  return defaultModel;
};

/**
 * Tạo một Proxy trong suốt (Transparent Proxy) cho Mongoose Model
 * Mọi lời gọi static (find, findOne, create...), constructor (new Model)
 * đều tự động trỏ đến Model instance của Connection thuộc Chi nhánh trong request hiện tại.
 */
const createModelProxy = (modelName, defaultModel) => {
  return new Proxy(defaultModel || {}, {
    get(target, prop, receiver) {
      const activeModel = getModel(modelName, defaultModel);
      if (!activeModel) return undefined;
      const value = Reflect.get(activeModel, prop, receiver);
      if (typeof value === "function") {
        return value.bind(activeModel);
      }
      return value;
    },
    set(target, prop, value, receiver) {
      const activeModel = getModel(modelName, defaultModel);
      return Reflect.set(activeModel || target, prop, value, receiver);
    },
    construct(target, argArray, newTarget) {
      const activeModel = getModel(modelName, defaultModel);
      return Reflect.construct(activeModel || target, argArray, newTarget);
    },
    apply(target, thisArg, argArray) {
      const activeModel = getModel(modelName, defaultModel);
      return Reflect.apply(activeModel || target, thisArg, argArray);
    },
  });
};

module.exports = {
  asyncLocalStorage,
  runWithContext,
  getContext,
  getModel,
  createModelProxy,
};
