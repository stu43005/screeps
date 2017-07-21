'use strict';

/*
 * harvester makes sure that extensions are filled
 *
 * Before storage or certains store threshold:
 *  - get dropped energy or from source
 *  - fill extensions
 *  - build constructionSites
 *  - upgrade Controller
 *
 * Proper storage store level:
 *  - Move along the harvester path
 *  - pathPos === 0 get energy from storage
 *  - transfer energy to extensions in range
 */

roles.harvester = {};

roles.harvester.settings = {
  param: ['controller.level', 'energyAvailable'],
  layoutString: 'MWC',
  amount: {
    1: [2, 1, 1],
    3: {
      0: [2, 1, 1],
      400: [1, 1, 1]
    }
  },
  maxLayoutAmount: 6,
};
roles.harvester.updateSettings = function(room, creep) {
  if (room.storage && room.storage.store.energy > config.creep.energyFromStorageThreshold) {
    return {
      prefixString: 'WMC',
      layoutString: 'MC',
      amount: [1, 1],
      maxLayoutAmount: 12
    };
  }
};

roles.harvester.stayInRoom = true;
roles.harvester.buildRoad = false;
roles.harvester.boostActions = ['capacity'];

roles.harvester.checkBeforeStroage = function(creep) {
  return !creep.room.storage || (creep.room.storage.store.energy + creep.carry.energy) < config.creep.energyFromStorageThreshold;
};

roles.harvester.preMove = function(creep, directions) {
  let resources = creep.room.find(FIND_DROPPED_RESOURCES, { filter: Creep.pickableResources(creep) });
  if (resources.length > 0) {
    let resource = Game.getObjectById(resources[0].id);
    creep.pickup(resource);
  }

  if (typeof(creep.memory.move_forward_direction) === 'undefined') {
    creep.memory.move_forward_direction = true;
  }

  creep.setNextSpawn();
  creep.spawnReplacement(1);

  if (roles.harvester.checkBeforeStroage(creep)) {
    creep.harvesterBeforeStorage();
    creep.memory.routing.reached = true;
    return true;
  }

  let reverse = creep.carry.energy === 0;

  if (creep.memory.routing.pathPos === 0) {
    for (let resource in creep.carry) {
      if (resource === RESOURCE_ENERGY) {
        continue;
      }
      creep.transfer(creep.room.storage, resource);
    }

    let returnCode = creep.withdraw(creep.room.storage, RESOURCE_ENERGY);
    if (returnCode === OK || returnCode === ERR_FULL) {
      creep.memory.move_forward_direction = true;
      reverse = false;
      creep.memory.routing.reverse = false;
      if (returnCode === OK) {
        return true;
      }
    }
  }

  if (!reverse && creep.room.memory.misplacedSpawn) {
    if (creep.transferEnergyMy()) {
      creep.memory.routing.reached = true;
      return true;
    }
  }

  // TODO Decide between, transfered no more energy (reverse), transferred other structures to transfer available (stay still), transferred no more structures (forward)
  let transferred = creep.transferToStructures();
  if (!reverse && transferred) {
    if (transferred.moreStructures) {
      reverse = true;
      return true;
    }
  }

  creep.memory.routing.reverse = reverse || !creep.memory.move_forward_direction;
  if (directions && creep.memory.routing.reverse) {
    directions.direction = directions.backwardDirection;
  }

  if (creep.room.memory.position.pathEndLevel) {
    if (creep.memory.routing.pathPos >= creep.room.memory.position.pathEndLevel[creep.room.controller.level]) {
      creep.memory.move_forward_direction = false;
      creep.memory.routing.reverse = true;
      delete creep.memory.routing.reached;
    }
  }
};

roles.harvester.action = function(creep) {
  if (!creep.memory.routing.targetId) {
    creep.memory.routing.targetId = 'harvester';
  }

  if (roles.harvester.checkBeforeStroage(creep)) {
    creep.harvesterBeforeStorage();
    creep.memory.routing.reached = false;
    return true;
  }

  creep.memory.move_forward_direction = false;
  creep.memory.routing.reverse = true;
  delete creep.memory.routing.reached;
  return true;
};

roles.harvester.execute = function(creep) {
  creep.log('execute');
  // TODO Something is broken
  creep.harvesterBeforeStorage();
  //   if (true) throw new Error();
  return false;
};
