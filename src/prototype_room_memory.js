'use strict';

/*
 * Memory abstraction layer
 *
 * The methods build the interface to the memory.
 * Path:
 * The idea is to cache paths as roomPosition in a global object.
 * Store paths from my rooms in a compressed form in memory.
 *
 * CostMatrix:
 * Store costMatrix for myRooms in cache and memory.
 * Other rooms are only stored in cache.
 */

/**
 * Stores the costMatrix in cache or in case of a controller room
 * in memory, too.
 *
 * @param {Object} costMatrix - the costMatrix to save
 */
Room.prototype.setMemoryCostMatrix = function(costMatrix) {
  this.checkCache();
  if (this.controller && this.controller.my || Game.gcl.level < config.performance.costMatrixMemoryMaxGCL) {
    if (!this.memory.costMatrix) {
      this.memory.costMatrix = {};
    }
    this.memory.costMatrix.base = costMatrix.serialize();
  }
  global.cache.rooms[this.name].costMatrix.base = costMatrix;
};

Room.prototype.clearMemory = function() {
  this.memory = {
    invalidated: Game.time,
  };
};

Room.prototype.checkCache = function() {
  this.memory.routing = this.memory.routing || {};
  if (!global.cache.rooms[this.name] || !global.cache.rooms[this.name].created ||
    this.memory.invalidated && global.cache.rooms[this.name].created < this.memory.invalidated) {
    global.cache.rooms[this.name] = {
      find: {},
      routing: {},
      costMatrix: {},
      created: Game.time,
    };
  }
};

/**
 * Returns the costMatrix for the room. The cache will be populated
 * from memory.
 *
 * @return {CostMatrix|undefined}
 */
Room.prototype.getMemoryCostMatrix = function() {
  this.checkCache();

  if (!global.cache.rooms[this.name].costMatrix.base) {
    if (!this.memory.costMatrix || !this.memory.costMatrix.base) {
      return;
    }
    global.cache.rooms[this.name].costMatrix.base = PathFinder.CostMatrix.deserialize(this.memory.costMatrix.base);
  }
  return global.cache.rooms[this.name].costMatrix.base;
};

/**
 * Returns all paths for this room from cache. Checks if cache and memory
 * paths fit, otherwise populate cache.
 *
 * @return {object}
 */
Room.prototype.getMemoryPaths = function() {
  this.checkCache();
  const memoryKeys = Object.keys(this.memory.routing).sort();
  const cacheKeys = Object.keys(global.cache.rooms[this.name].routing).sort();
  const diff = _.difference(memoryKeys, cacheKeys);
  for (const item of diff) {
    //    this.log(`getPaths ${item} missing in cache`);
    let path;
    try {
      path = Room.stringToPath(this.memory.routing[item].path);
    } catch (e) {
      path = this.memory.routing[item].path;
      this.memory.routing[item].path = Room.pathToString(path);
    }

    global.cache.rooms[this.name].routing[item] = {
      path: path,
      created: this.memory.routing[item].created,
      fixed: this.memory.routing[item].fixed,
      name: this.memory.routing[item].name,
    };
  }
  return global.cache.rooms[this.name].routing;
};

/**
 * Returns the path for the given name. Checks for validity and populated
 * cache if missing.
 *
 * @param {String} name - the name of the path
 * @return {array|boolean} path
 */
Room.prototype.getMemoryPath = function(name) {
  this.checkCache();

  const isValid = function(path) {
    return path.fixed || path.created > Game.time - config.path.refresh;
  };

  if (global.cache.rooms[this.name].routing[name] && isValid(global.cache.rooms[this.name].routing[name])) {
    return cache.rooms[this.name].routing[name].path;
  }

  if (this.memory.routing[name] && isValid(this.memory.routing[name])) {
    //    this.log(`getPath ${name} missing in cache`);
    let path;
    try {
      path = Room.stringToPath(this.memory.routing[name].path);
    } catch (e) {
      path = this.memory.routing[name].path;
      this.memory.routing[name].path = Room.pathToString(path);
    }
    global.cache.rooms[this.name].routing[name] = {
      path: path,
      created: this.memory.routing[name].created,
      fixed: this.memory.routing[name].fixed,
      name: this.memory.routing[name].name,
    };
    return global.cache.rooms[this.name].routing[name].path;
  }
  return false;
};

/**
 * Cleans the cache and memory from all paths
 */
Room.prototype.deleteMemoryPaths = function() {
  this.checkCache();
  global.cache.rooms[this.name].routing = {};
  delete this.memory.routing;
};

/**
 * Removes the named path from cache and memory
 *
 * @param {String} name - the name of the path
 */
Room.prototype.deleteMemoryPath = function(name) {
  this.checkCache();
  delete global.cache.rooms[this.name].routing[name];
  delete this.memory.routing[name];
};

/**
 * Stores the given path under the name in cache. If `fixed` is true
 * the path is stored in memory serialized.
 *
 * @param {String} name - the name of the path
 * @param {Array} path - the path itself
 * @param {boolean} fixed - Flag to define if the path should be stored in memory
 */
Room.prototype.setMemoryPath = function(name, path, fixed) {
  this.checkCache();
  const data = {
    path: path,
    created: Game.time,
    fixed: fixed,
    name: name,
  };
  global.cache.rooms[this.name].routing[name] = data;
  if (fixed) {
    const memoryData = {
      path: Room.pathToString(path),
      created: Game.time,
      fixed: fixed,
      name: name,
    };
    this.memory.routing[name] = memoryData;
  }
};
