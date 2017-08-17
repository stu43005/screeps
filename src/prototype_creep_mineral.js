'use strict';

Creep.prototype.transferAllResourcesTo = function(target) {
  this.moveToMy(target.pos);
  for (let resource of Object.keys(this.carry)) {
    this.transfer(target, resource);
  }
};

Creep.prototype.withdrawAllMineralsFromStorage = function() {
  this.moveToMy(this.room.storage.pos);
  for (let resource in this.room.storage.store) {
    if (resource === RESOURCE_ENERGY || resource === RESOURCE_POWER) {
      continue;
    }
    this.withdraw(this.room.storage, resource);
  }
};

Creep.prototype.checkStorageMinerals = function() {
  if (!this.room.isMineralInStorage()) {
    if (!this.memory.checkStorage || _.sum(this.carry) === 0) {
      delete this.memory.checkStorage;
      return false;
    }
  }
  this.say('checkStorage');
  this.memory.checkStorage = true;

  if (_.sum(this.carry) > 0) {
    this.transferAllResourcesTo(this.room.terminal);
    return true;
  }

  this.withdrawAllMineralsFromStorage();
  return true;
};

Creep.prototype.checkEnergyThreshold = function(structure, value, below = false) {
  if (below) {
    return this.room[structure].store.energy <= value;
  }
  return this.room[structure].store.energy > value;
};

Creep.prototype.checkTerminalEnergy = function() {
  if (!this.room.memory.terminalTooLessEnergy &&
    (this.checkEnergyThreshold(STRUCTURE_TERMINAL, config.terminal.minEnergyAmount) ||
      this.checkEnergyThreshold(STRUCTURE_STORAGE, config.terminal.storageMinEnergyAmount, true)) &&
    this.checkEnergyThreshold(STRUCTURE_TERMINAL, config.terminal.maxEnergyAmount, true)) {
    if (!this.memory.checkTerminal || _.sum(this.carry) === 0) {
      delete this.memory.checkTerminal;
      return false;
    }
  }

  this.say('terminal', true);
  this.memory.checkTerminal = true;

  let from = this.room.storage;
  let to = this.room.terminal;
  if (!this.room.memory.terminalTooLessEnergy && this.checkEnergyThreshold(STRUCTURE_TERMINAL, (config.terminal.minEnergyAmount + config.terminal.maxEnergyAmount) / 2)) {
    from = this.room.terminal;
    to = this.room.storage;
  }

  if (this.pos.getRangeTo(this.room.terminal) < 2) {
    for (let resource of Object.keys(this.carry)) {
      if (resource === RESOURCE_ENERGY) {
        continue;
      }
      this.transfer(this.room.terminal, resource);
    }
  }

  if (this.carry.energy > 0) {
    this.moveToMy(to.pos);
    this.transfer(to, RESOURCE_ENERGY);
    return true;
  }
  this.moveToMy(from.pos);
  this.withdraw(from, RESOURCE_ENERGY);
  return true;
};

let nextState = function(creep) {
  creep.memory.state = (creep.memory.state + 1) % states.length;
};

let get = function(creep, target, resource) {
  if (_.sum(creep.carry) === creep.carryCapacity) {
    //    creep.log('next state no capacity' + target);
    nextState(creep);
    return;
  }

  if (creep.carry[resource]) {
    //    creep.log('next state already carrying' + target);
    nextState(creep);
    return;
  }

  if (target instanceof StructureTerminal && !target.store[resource]) {
    //    creep.log('next state terminal no resource' + target);
    nextState(creep);
    return;
  }

  if (target instanceof StructureLab && target.mineralAmount === 0) {
    //    creep.log('next state lab no mineral' + target);
    nextState(creep);
    return;
  }

  let amount = 0;
  if (target instanceof StructureTerminal) {
    amount = Math.min(target.store[resource], creep.carryCapacity / 2);
  }

  if (target instanceof StructureLab) {
    amount = Math.min(target.mineralAmount, creep.carryCapacity - _.sum(creep.carry));
    //    if (target.mineral != resource) {
    //      delete creep.room.memory.reaction;
    //    }
  }

  if (target instanceof StructureStorage) {
    resource = 'energy';
    amount = Math.min(target.store[resource], creep.carryCapacity - _.sum(creep.carry));
  }

  if (amount === 0) {
    //creep.log('next state no amount' + target);
    nextState(creep);
    return;
  }

  let returnCode = creep.withdraw(target, resource, amount);
  //  if (target instanceof StructureStorage) {
  //    creep.log('creep.withdray: ' + returnCode + ' ' + target + ' ' + resource + ' ' + amount);
  //  }
  if (returnCode === OK || returnCode === ERR_FULL || returnCode === ERR_NOT_ENOUGH_RESOURCES) {
    //creep.log('next state transfer ok: ' + returnCode + ' ' + target);
    nextState(creep);
    return true;
  }
  if (returnCode === ERR_NOT_IN_RANGE) {
    return true;
  }
  if (returnCode === ERR_INVALID_ARGS) {
    delete creep.room.memory.reaction;
    return false;
  }
  creep.log('get: ' + returnCode + ' target: ' + target + ' resource: ' + resource + ' amount: ' + amount);
  creep.log(target.mineralAmount + ' ' + (creep.carryCapacity - _.sum(creep.carry)));
};

let cleanUpLabs = function(creep) {
  creep.say('cleanup');
  if (_.sum(creep.carry) > 0) {
    creep.transferAllResourcesTo(creep.room.terminal);
  } else {
    const lab = creep.pos.findClosestByRangePropertyFilter(FIND_STRUCTURES, 'structureType', [STRUCTURE_LAB], false, {
      filter: lab => lab.mineralAmount > 0
    });
    if (lab === null) {
      // Nothing to do?
      creep.moveRandom();
      return false;
    }

    creep.moveToMy(lab.pos);
    creep.withdraw(lab, lab.mineralType);
    //    creep.log(returnCode + ' ' + lab.mineralType + ' ' + JSON.stringify(lab));
  }
};

let transfer = function(creep, target, resource) {
  if (target instanceof StructureTerminal) {
    for (let carryResource in creep.carry) {
      if (carryResource === resource) {
        continue;
      }
      if (creep.carry[carryResource] > 0) {
        creep.transfer(target, carryResource);
        return true;
      }
    }
  }

  if (!creep.carry[resource]) {
    nextState(creep);
    return;
  }

  let returnCode = creep.transfer(target, resource);
  if (returnCode === OK) {
    nextState(creep);
    return;
  }
  if (returnCode === ERR_FULL) {
    nextState(creep);
    return;
  }
  if (returnCode === ERR_NOT_IN_RANGE) {
    return;
  }
  creep.log('Transfer to: ' + target + 'failed with: ' + returnCode);
};

let checkBoostAction = function(creep) {
  if (creep.memory.boostAction) {
    return true;
  }
  let mineral;
  let isReactionLab = lab => creep.room.memory.reaction && creep.room.memory.reaction.labs.some(labId => labId === lab.id);
  let labForMineral = lab => lab.mineralType === mineral && !isReactionLab(lab);
  let labEmpty = lab => !lab.mineralType && !isReactionLab(lab);

  for (mineral in creep.room.memory.boosting) {
    if (Object.keys(creep.room.memory.boosting[mineral]).length === 0 || !creep.room.terminal.store[mineral]) {
      delete creep.room.memory.boosting[mineral];
      continue;
    }
    let labs = creep.room.findPropertyFilter(FIND_STRUCTURES, 'structureType', [STRUCTURE_LAB], false, { filter: labForMineral });
    if (labs.length > 0) {
      if (labs[0].mineralAmount === labs[0].mineralsCapacity) {
        if (labs[0].energy === labs[0].energyCapacity) {
          continue;
        }
      }
      creep.memory.boostAction = {
        mineral: mineral,
        lab: labs[0].id
      };
      return true;
    }

    labs = creep.room.findPropertyFilter(FIND_STRUCTURES, 'structureType', [STRUCTURE_LAB], false, { filter: labEmpty });
    if (labs.length > 0) {
      creep.memory.boostAction = {
        mineral: mineral,
        lab: labs[0].id
      };
      return true;
    }
    //    creep.log('No free labs');
  }
  return false;
};

let prepareBoost = function(creep) {
  if (!checkBoostAction(creep)) {
    return false;
  }

  creep.say('A3');

  let lab = Game.getObjectById(creep.memory.boostAction.lab);
  if (!lab) {
    return false;
  }
  if (lab.energy < lab.energyCapacity) {
    creep.say('boost');
    if (creep.carry.energy > 0) {
      creep.moveToMy(lab.pos);
      creep.transfer(lab, RESOURCE_ENERGY);
      return true;
    } else {
      creep.moveToMy(creep.room.storage.pos);
      if (_.sum(creep.carry) > 0) {
        creep.transferAllResourcesTo(creep.room.storage);
      }
      creep.withdraw(creep.room.storage, RESOURCE_ENERGY);
      return true;
    }
  }

  if (lab.mineralAmount < lab.mineralCapacity) {
    creep.say('mineral');
    if (creep.carry[creep.memory.boostAction.mineral] > 0) {
      creep.moveToMy(lab.pos);
      creep.transfer(lab, creep.memory.boostAction.mineral);
      return true;
    } else {
      if (!creep.room.terminal.store[creep.memory.boostAction.mineral]) {
        //        creep.log('For boosting ' + creep.memory.boostAction.mineral + ' not available');
        delete creep.memory.boostAction;
        return false;
      }

      creep.moveToMy(creep.room.terminal.pos);
      if (_.sum(creep.carry) > 0) {
        creep.transferAllResourcesTo(creep.room.terminal);
      }
      creep.withdraw(creep.room.terminal, creep.memory.boostAction.mineral);
      return true;
    }
  }
  creep.say('delete');
  delete creep.memory.boostAction;
  return false;
};

let checkNuke = function(creep) {
  if (creep.room.terminal.store[RESOURCE_GHODIUM] > 500 || creep.carry[RESOURCE_GHODIUM]) {
    let nukers = creep.room.findPropertyFilter(FIND_STRUCTURES, 'structureType', [STRUCTURE_NUKER]);
    if (nukers.length > 0) {
      let nuker = nukers[0];
      if (nuker.ghodium < nuker.ghodiumCapacity) {
        if (creep.carry[RESOURCE_GHODIUM] > 0) {
          creep.moveToMy(nuker.pos);
          creep.transfer(nuker, RESOURCE_GHODIUM);
        } else {
          creep.moveToMy(creep.room.terminal.pos);
          if (_.sum(creep.carry) > 0) {
            creep.transferAllResourcesTo(creep.room.terminal);
          }
          creep.withdraw(creep.room.terminal, RESOURCE_GHODIUM);
        }
        return true;
      }
    }
  }
  return false;
};

let states = [{
  name: 'storage result',
  destination: STRUCTURE_TERMINAL,
  action: transfer,
  resource: 'result'
}, {
  name: 'terminal 0',
  destination: STRUCTURE_TERMINAL,
  action: get,
  resource: 'first'
}, {
  name: 'terminal 1',
  destination: STRUCTURE_TERMINAL,
  action: get,
  resource: 'second'
}, {
  name: 'lab 1',
  destination: STRUCTURE_LAB,
  lab: 1,
  action: transfer,
  resource: 'first'
}, {
  name: 'lab 2',
  destination: STRUCTURE_LAB,
  lab: 2,
  action: transfer,
  resource: 'second'
}, {
  name: 'get energy',
  destination: STRUCTURE_STORAGE,
  action: get,
  resource: 'energy'
}, {
  name: 'lab 1',
  destination: STRUCTURE_LAB,
  lab: 1,
  action: transfer,
  resource: 'energy'
}, {
  name: 'lab 2',
  destination: STRUCTURE_LAB,
  lab: 2,
  action: transfer,
  resource: 'energy'
}, {
  name: 'lab result1',
  destination: STRUCTURE_LAB,
  lab: 0,
  action: get,
  resource: 'result'
}];

// TODO totally ugly copy&paste from creep_mineral to migrate to role_mineral
Creep.prototype.handleMineralCreep = function() {
  if (!this.room.terminal) {
    this.suicide();
    return true;
  }

  if (this.room.memory.reaction) {
    let lab0 = Game.getObjectById(this.room.memory.reaction.labs[0]);
    let lab1 = Game.getObjectById(this.room.memory.reaction.labs[1]);
    let lab2 = Game.getObjectById(this.room.memory.reaction.labs[2]);

    if (lab0 === null || lab1 === null || lab2 === null) {
      delete this.room.memory.reaction;
      delete this.room.memory.fullLab;
    } else {
      if (lab0.cooldown === 0) {
        lab0.runReaction(lab1, lab2);
      }

      if (lab0.mineralAmount > lab0.mineralCapacity - 100) {
        this.room.memory.fullLab = true;
      }

      if (lab0.mineralAmount < 100) {
        delete this.room.memory.fullLab;
      }

      if (this.room.memory.fullLab) {
        if (_.sum(this.carry) > 0) {
          this.memory.state = 0;
        }
        if (_.sum(this.carry) === 0) {
          this.memory.state = 8;
        }
      }
    }
  }

  if (!this.memory.checkStorage && this.checkTerminalEnergy()) {
    return true;
  }

  if (this.checkStorageMinerals()) {
    return true;
  }

  if (this.room.memory.boosting && Object.keys(this.room.memory.boosting).length > 0) {
    if (prepareBoost(this)) {
      return true;
    }
  }

  if (checkNuke(this)) {
    return true;
  }

  this.memory.state = this.memory.state || 0;

  this.say(this.memory.state);

  if (!this.room.memory.reaction) {
    cleanUpLabs(this);
    //    creep.log('No reactions?');
    return true;
  }

  let state = states[this.memory.state];

  let target = this.room.terminal;
  if (state.destination === STRUCTURE_LAB) {
    target = Game.getObjectById(this.room.memory.reaction.labs[state.lab]);
  } else if (state.destination === STRUCTURE_STORAGE) {
    target = this.room.storage;
  }

  if (this.isStuck()) {
    this.moveRandomWithin(target.pos);
  } else {
    this.moveToMy(target.pos);
  }

  let resource = RESOURCE_ENERGY;
  if (state.resouce != 'energy') {
    resource = this.room.memory.reaction.result[state.resource];
  }

  state.action(this, target, resource);

  return true;
};

Creep.prototype.getBoostMinerals = function() {
  if (this.memory.boosts) {
    return this.memory.boosts;
  }

  let unit = roles[this.memory.role];
  if (!unit.boostActions) {
    return [];
  }

  let parts = {};
  for (let part of this.body) {
    if (part.boost) {
      continue;
    }
    parts[part.type] = true;
  }

  let boosts = [];
  for (let part in parts) {
    for (let boost in BOOSTS[part]) {
      for (let action in BOOSTS[part][boost]) {
        if (unit.boostActions.indexOf(action) > -1) {
          // this.log('boost: ' + part + ' ' + boost + ' ' + action);
          boosts.push(boost);
        }
      }
    }
  }
  this.memory.boosts = boosts;
  return this.memory.boosts;
};

Creep.prototype.boost = function() {
  if (!this.room.terminal || !this.room.terminal.my) {
    return false;
  }

  let boosts = this.getBoostMinerals();
  if (!boosts || boosts.length === 0) {
    return false;
  }

  let filterLabType = boost => lab => lab.mineralType === boost && lab.mineralAmount >= 30 && lab.energy >= 20;

  if (this.memory.boosting) {
    let lab = Game.getObjectById(this.memory.boosting.lab);
    if (!lab || !filterLabType(this.memory.boosting.boost)(lab)) {
      delete this.memory.boosting;
      return false;
    }
    if (this.pos.getRangeTo(lab.pos) > 1) {
      let returnCode = this.moveToMy(lab.pos, 1);
    } else {
      let returnCode = lab.boostCreep(this);
      if (returnCode === OK || returnCode === ERR_NOT_FOUND) {
        if (this.room.memory.boosting[this.memory.boosting.boost]) {
          delete this.room.memory.boosting[this.memory.boosting.boost][this.id];
        }
        delete this.memory.boosts;
        delete this.memory.boosting;
        this.memory.boosted = true;
      }
      this.log('Boost returnCode: ' + returnCode + ' lab: ' + lab.pos);
      this.say('br:' + returnCode);
    }
    return true;
  }

  let allLabs = this.room.findPropertyFilter(FIND_STRUCTURES, 'structureType', [STRUCTURE_LAB], false, {
    filter: lab => lab.mineralAmount > 30 && lab.energy > 20
  });

  for (let boost of boosts) {
    let labs = allLabs.filter(filterLabType(boost));
    if (this.room.terminal.store[boost] || labs.length > 0) {
      //            this.log('Could boost with: ' + part + ' ' + boost + ' ' + action + ' terminal: ' + this.room.terminal.store[boost] + ' lab: ' + JSON.stringify(labs));
      this.room.memory.boosting = this.room.memory.boosting || {};
      this.room.memory.boosting[boost] = this.room.memory.boosting[boost] || {};
      this.room.memory.boosting[boost][this.id] = true;

      if (labs.length > 0) {
        this.memory.boosting = {
          lab: labs[0].id,
          boost
        };
        return true;
      }

      return false;
    }
  }

  return false;
};
