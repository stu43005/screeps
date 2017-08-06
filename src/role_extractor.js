'use strict';

/*
 * extractor gets minerals from the extractor
 *
 * Moves, harvest, brings to the terminal
 */

roles.extractor = {};

roles.extractor.boostActions = ['harvest', 'capacity'];

roles.extractor.settings = {
  layoutString: 'MCW',
  amount: [5, 1, 4],
  maxLayoutAmount: 5,
};

roles.extractor.terminalStorageExchange = function(creep) {
  var terminal = creep.room.terminal;
  if (!terminal || !terminal.isActive()) {
    // TODO kill creep?
    return ERR_INVALID_TARGET;
  }
  var energyInTerminal = terminal.store.energy / terminal.storeCapacity;
  var totalInTerminal = _.sum(terminal.store) / terminal.storeCapacity;

  var action = {
    withdraw: creep.carry.energy / creep.carryCapacity < 0.8,
    transfer: creep.carry.energy / creep.carryCapacity > 0.3
  };

  if (!action.transfer && (energyInTerminal < 0.5) && (totalInTerminal !== 1)) {
    return ERR_NOT_ENOUGH_RESOURCES;
  }

  if (totalInTerminal > 0.5) {
    // TODO call carry to move energy from
  }
  // transferToStructures then decide go to terminal or storage
  creep.transferToStructures();

  // TODO replace creep.moveTo by moving on path ?

  if (action.withdraw) {
    for (let key in creep.carry) {
      if (key === RESOURCE_ENERGY) {
        continue;
      }
      if (creep.carry[key] === 0) {
        continue;
      }
      creep.transfer(terminal, key);
    }
    if (creep.withdraw(terminal, RESOURCE_ENERGY) !== OK) {
      creep.moveToMy(terminal.pos);
    }
  }

  if (!action.withdraw || action.transfer) {
    if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) !== OK) {
      creep.moveToMy(creep.room.storage.pos);
    }
  }
  if (!action.withdraw && !action.transfer) {
    return ERR_NOT_FOUND;
  }

  return OK;
};

function executeExtractor(creep) {
  let returnValue = roles.extractor.terminalStorageExchange(creep);
  if (returnValue === OK) {
    return true;
  } else {
    return creep.handleExtractor();
  }
}

roles.extractor.action = executeExtractor;

roles.extractor.execute = executeExtractor;
