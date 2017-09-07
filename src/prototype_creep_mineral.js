'use strict';
Creep.prototype.transferAllMineralsToTerminal = function() {
  this.moveToMy(this.room.terminal.pos);
  for (let transfer of Object.keys(this.carry)) {
    let resource = this.transfer(this.room.terminal, transfer);
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
    return false;
  }
  this.say('checkStorage');

  if (_.sum(this.carry) > 0) {
    this.transferAllMineralsToTerminal();
    return true;
  }

  this.withdrawAllMineralsFromStorage();
  return true;
};

Creep.prototype.checkEnergyThreshold = function(structure, value, below = false) {
  if (below) {
    return this.room[structure].store.energy < value;
  }
  return this.room[structure].store.energy + this.carry.energy > value;
};

Creep.prototype.moveEnergyBetween = function(from, to) {
  if (this.pos.isNearTo(this.room[STRUCTURE_TERMINAL]) && _.sum(this.carry) > this.carry.energy) {
    for (let resource of Object.keys(this.carry)) {
      if (resource !== RESOURCE_ENERGY) {
        this.transfer(this.room[STRUCTURE_TERMINAL], resource);
        return;
      }
    }
  }
  if (this.carry.energy > 0) {
    this.moveToMy(this.room[to].pos);
    this.transfer(this.room[to], RESOURCE_ENERGY);
  } else {
    this.moveToMy(this.room[from].pos);
    this.withdraw(this.room[from], RESOURCE_ENERGY);
  }
};

Creep.prototype.checkTerminalEnergy = function() {
  if (this.checkEnergyThreshold(STRUCTURE_TERMINAL, config.terminal.energyMax) ||
    this.checkEnergyThreshold(STRUCTURE_STORAGE, config.terminal.storageMinEnergyAmount, true) && this.checkEnergyThreshold(STRUCTURE_TERMINAL, config.terminal.energyAmount)) {

    this.say('storage');
    this.moveEnergyBetween(STRUCTURE_TERMINAL, STRUCTURE_STORAGE);
    return true;
  }

  if (this.checkEnergyThreshold(STRUCTURE_TERMINAL, config.terminal.energyAmount, true) && this.checkEnergyThreshold(STRUCTURE_STORAGE, config.terminal.storageMinEnergyAmount)) {
    this.say('terminal');
    this.moveEnergyBetween(STRUCTURE_STORAGE, STRUCTURE_TERMINAL);
    return true;
  }

  return false;
};

Creep.prototype.checkLabEnoughMineral = function(lab, mineralType) {
  if (lab.mineralAmount < LAB_REACTION_AMOUNT && !this.room.terminal.store[mineralType] && !this.carry[mineralType]) {
    if (config.debug.mineral) {
      this.log('Not enough', mineralType, 'stop reaction');
    }
    delete this.room.memory.reaction;
    return false;
  }
  return true;
};

// TODO totally ugly copy&paste from creep_mineral to migrate to role_mineral
Creep.prototype.handleMineralCreep = function() {
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
    name: 'storage energy',
    destination: STRUCTURE_TERMINAL,
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

  function nextState(creep) {
    creep.memory.state = (creep.memory.state + 1) % states.length;
  }

  function get(creep, target, resource) {
    if (_.sum(creep.carry) === creep.carryCapacity) {
      if (target instanceof StructureTerminal) {
        if (creep.pos.isNearTo(target)) {
          for (let res of Object.keys(creep.carry)) {
            if (res !== resource) {
              creep.transfer(target, res);
            }
          }
        }
      } else {
        if (config.debug.mineral) {
          creep.log('next state no capacity' + target);
        }
        nextState(creep);
      }
      return;
    }

    if (creep.carry[resource]) {
      if (config.debug.mineral) {
        creep.log('next state already carrying' + target);
      }
      nextState(creep);
      return;
    }

    if (target instanceof StructureTerminal && !target.store[resource]) {
      if (config.debug.mineral) {
        creep.log('next state terminal no resource' + target);
      }
      nextState(creep);
      return;
    }

    if (target instanceof StructureLab && target.mineralAmount === 0) {
      if (config.debug.mineral) {
        creep.log('next state lab no mineral' + target);
      }
      nextState(creep);
      return;
    }

    let amount = 0;
    if (target instanceof StructureTerminal) {
      if (resource === 'energy') {
        amount = Math.min(target.store[resource], creep.carryCapacity - _.sum(creep.carry));
      } else {
        amount = Math.min(target.store[resource], creep.carryCapacity / 2);
      }
    }

    if (target instanceof StructureLab) {
      amount = Math.min(target.mineralAmount, creep.carryCapacity - _.sum(creep.carry));
      //    if (target.mineral != resource) {
      //      delete creep.room.memory.reaction;
      //    }
    }

    if (amount === 0) {
      if (config.debug.mineral) {
        creep.log('next state no amount' + target);
      }
      nextState(creep);
      return;
    }

    let returnCode = creep.withdraw(target, resource, amount);
    if (target instanceof StructureStorage) {
      if (config.debug.mineral) {
        creep.log('creep.withdray: ' + returnCode + ' ' + target + ' ' + resource + ' ' + amount);
      }
    }
    if (returnCode === OK || returnCode === ERR_FULL || returnCode === ERR_NOT_ENOUGH_RESOURCES) {
      if (config.debug.mineral) {
        creep.log('next state transfer ok: ' + returnCode + ' ' + target);
      }
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
  }

  function cleanUpLabs(creep) {
    creep.say('cleanup');
    if (_.sum(creep.carry) > 0) {

      let returnCode = creep.moveToMy(creep.room.terminal.pos);

      for (let resource in creep.carry) {
        if (creep.carry[resource] === 0) {
          continue;
        }
        let returnCode = creep.transfer(creep.room.terminal, resource);
        if (config.debug.mineral) {
          creep.log(returnCode + ' ' + resource + ' ' + JSON.stringify(resource));
        }
        break;
      }
    } else {
      const lab = creep.pos.findClosestByRangePropertyFilter(FIND_STRUCTURES, 'structureType', [STRUCTURE_LAB], false, {
        filter: lab => lab.mineralAmount > 0
      });
      if (lab === null) {
        // Nothing to do?
        creep.moveRandom();
        return false;
      }
      let returnCode = creep.moveToMy(lab.pos);

      returnCode = creep.withdraw(lab, lab.mineralType);
      if (config.debug.mineral) {
        creep.log(returnCode + ' ' + lab.mineralType + ' ' + JSON.stringify(lab));
      }
    }
  }

  function transfer(creep, target, resource) {
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
  }

  function checkBoostAction(creep) {
    if (creep.memory.boostAction) {
      return true;
    }
    let room = Game.rooms[creep.room.name];
    let mineral;
    let labForMineral = lab => lab.mineralType === mineral;
    let labEmpty = object => !object.mineralType || object.mineralType === null;

    for (mineral in room.memory.boosting) {
      if (Object.keys(creep.room.memory.boosting[mineral]).length === 0 || !creep.room.terminal.store[mineral]) {
        delete creep.room.memory.boosting[mineral];
        continue;
      }
      let labs = room.findPropertyFilter(FIND_STRUCTURES, 'structureType', [STRUCTURE_LAB], false, { filter: labForMineral });
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

      labs = room.findPropertyFilter(FIND_STRUCTURES, 'structureType', [STRUCTURE_LAB], false, { filter: labEmpty });
      if (labs.length > 0) {
        creep.memory.boostAction = {
          mineral: mineral,
          lab: labs[0].id
        };
        return true;
      }
      if (config.debug.mineral) {
        creep.log('No free labs');
      }
    }
    return false;
  }

  function prepareBoost(creep) {
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
        let returnCode = creep.moveToMy(lab.pos);
        creep.transfer(lab, RESOURCE_ENERGY);
        return true;
      } else {
        let returnCode = creep.moveToMy(creep.room.storage.pos);

        if (_.sum(creep.carry) > 0) {
          for (let resource in creep.carry) {
            creep.transfer(creep.room.storage, resource);
          }
        }
        returnCode = creep.withdraw(creep.room.storage, RESOURCE_ENERGY);
        return true;
      }
    }

    if (lab.mineralAmount < lab.mineralCapacity) {
      creep.say('mineral');
      if (creep.carry[creep.memory.boostAction.mineral] > 0) {
        let returnCode = creep.moveToMy(lab.pos);

        creep.transfer(lab, creep.memory.boostAction.mineral);
        return true;
      } else {
        if (!creep.room.terminal.store[creep.memory.boostAction.mineral]) {
          if (config.debug.mineral) {
            creep.log('For boosting ' + creep.memory.boostAction.mineral + ' not available');
          }
          return false;
        }

        let returnCode = creep.moveToMy(creep.room.terminal.pos);

        creep.withdraw(creep.room.terminal, creep.memory.boostAction.mineral);
        return true;
      }
    }
    creep.say('delete');
    delete creep.memory.boostAction;
    return false;
  }

  function checkNuke(creep) {
    if (creep.room.terminal.store[RESOURCE_GHODIUM] > 500 || creep.carry[RESOURCE_GHODIUM]) {
      let nukers = creep.room.findPropertyFilter(FIND_STRUCTURES, 'structureType', [STRUCTURE_NUKER]);
      if (nukers.length > 0) {
        let nuker = nukers[0];
        if (nuker.ghodium < nuker.ghodiumCapacity) {
          if (creep.carry[RESOURCE_GHODIUM] > 0) {
            let returnCode = creep.moveToMy(nuker.pos);
            creep.transfer(nuker, RESOURCE_GHODIUM);
          } else {
            let returnCode = creep.moveToMy(creep.room.terminal.pos);

            creep.withdraw(creep.room.terminal, RESOURCE_GHODIUM);
          }
          return true;
        }
      }
    }
    return false;
  }

  let execute = function(creep) {
    if (!creep.room.terminal) {
      creep.suicide();
      return true;
    }
    if (creep.ticksToLive < 50 && _.sum(creep.carry) === 0) {
      // early suicide to not waste minerals
      creep.suicide();
      return true;
    }

    if (creep.checkTerminalEnergy()) {
      return true;
    }

    if (creep.checkStorageMinerals()) {
      return true;
    }

    let room = Game.rooms[creep.room.name];

    let lab0;
    let lab1;
    let lab2;
    if (room.memory.reaction) {
      lab0 = Game.getObjectById(room.memory.reaction.labs[0]);
      lab1 = Game.getObjectById(room.memory.reaction.labs[1]);
      lab2 = Game.getObjectById(room.memory.reaction.labs[2]);

      if (lab0 === null || lab1 === null || lab2 === null) {
        delete creep.room.memory.reaction;
      } else {
        if (lab0.cooldown === 0) {
          const returnCode = lab0.runReaction(lab1, lab2);
          if (returnCode === ERR_NOT_ENOUGH_RESOURCES) {
            if (!creep.checkLabEnoughMineral(lab1, room.memory.reaction.result.first) || !creep.checkLabEnoughMineral(lab2, room.memory.reaction.result.second)) {
              cleanUpLabs(creep);
            }
          }
        }

      }
      if (lab0.mineralAmount > lab0.mineralCapacity - 100 && creep.room.memory.reaction) {
        creep.room.memory.fullLab = 1;
      }

      if (lab0.mineralAmount < 100) {
        creep.room.memory.fullLab = 0;
      }
    }

    if (creep.room.memory.fullLab === 1) {
      if (_.sum(creep.carry) > 0) {
        creep.memory.state = 0;
      }
      if (_.sum(creep.carry) === 0) {
        creep.memory.state = 8;
      }
    }
    if (room.memory.boosting && Object.keys(room.memory.boosting).length > 0) {
      if (prepareBoost(creep)) {
        return true;
      }
    }

    if (checkNuke(creep)) {
      return true;
    }

    creep.say('A1');

    if (room.memory.terminalTooLessEnergy) {
      if (_.sum(creep.carry) - creep.carry.energy > 0) {
        let returnCode = creep.moveToMy(creep.room.terminal.pos);

        for (let resource in creep.carry) {
          creep.transfer(room.terminal, resource);
        }
        return true;
      }

      creep.say('TEnergy');
      let target = creep.room.storage;
      if (creep.carry.energy > 0) {
        target = creep.room.terminal;
      }
      let returnCode = creep.moveToMy(target.pos);
      creep.transfer(target, RESOURCE_ENERGY);
      return true;
    }

    creep.say(creep.memory.state);

    creep.memory.state = creep.memory.state || 0;

    if (!room.memory.reaction) {
      cleanUpLabs(creep);
      if (config.debug.mineral) {
        creep.log('No reactions?');
      }
      return true;
    }

    let state = states[creep.memory.state];

    let target = creep.room.terminal;
    if (state.destination === STRUCTURE_LAB) {
      target = Game.getObjectById(room.memory.reaction.labs[state.lab]);
    } else if (state.destination === STRUCTURE_STORAGE) {
      target = creep.room.storage;
    }

    creep.moveToMy(target.pos);

    let resource = RESOURCE_ENERGY;
    if (state.resouce !== 'energy') {
      resource = room.memory.reaction.result[state.resource];
    }

    state.action(creep, target, resource);

    return true;
  };

  execute(this);
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
      if (config.debug.mineral) {
        this.log('Could boost with: ' + boost + ' terminal: ' + this.room.terminal.store[boost] + ' lab: ' + JSON.stringify(labs));
      }
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
