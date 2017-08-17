'use strict';

/*
 * Called to defend external rooms
 *
 * Fights against hostile creeps
 */

roles.defender = {};
roles.defender.boostActions = ['fatigue', 'rangedAttack', 'heal', 'damage'];

roles.defender.settings = {
  param: ['controller.level'],
  layoutString: 'MRH',
  amount: {
    1: [2, 1, 1],
    8: [4, 1, 1]
  },
  fillTough: true
};

roles.defender.action = function(creep) {
  if (creep.memory.routing.targetRoom != creep.room.name) {
    creep.memory.routing.reached = false;
    return false;
  }
  if (creep.inBase() && creep.memory.reverse) {
    return Creep.recycleCreep(creep);
  }
  // TODO Better in premove
  if (!creep.inBase()) {
    let walls = creep.pos.findInRangeStructures(FIND_STRUCTURES, 1, [STRUCTURE_WALL, STRUCTURE_RAMPART]);
    if (walls.length > 0) {
      if (!creep.room.controller || !creep.room.controller.my) {
        creep.rangedAttack(walls[0]);
      }
    }
  }

  creep.heal(creep);

  creep.handleDefender();
  return true;
};

roles.defender.preMove = function(creep, directions) {
  creep.heal(creep);
  let target = creep.findClosestEnemy();
  if (target !== null) {
    creep.handleDefender();
    return true;
  }
};

roles.defender.execute = function(creep) {
  creep.log('Execute!!!');
};
