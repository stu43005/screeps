'use strict';

/*
 * reserver is used to reserve controller in external harvesting rooms
 *
 * Moves to the controller and reserves
 * Currently checks if there are enough sourcer and maybe trigger a defender.
 */

roles.reserver = {};
roles.reserver.killPrevious = true;
// TODO should be true, but flee must be fixed  (2016-10-13)
roles.reserver.flee = false;

roles.reserver.settings = {
  layoutString: 'MK',
  maxLayoutAmount: 1,
};
roles.reserver.updateSettings = function(room, creep) {
  const partsData = room.getPartsStringDatas(roles.reserver.settings.layoutString);
  const level = creep.level ? creep.level : 1;
  for (let l = level; l > 0; l--) {
    if (room.energyCapacityAvailable > partsData.cost * l) {
      return {
        amount: [l, l],
      };
    }
  }
};

roles.reserver.action = function(creep) {
  creep.mySignController();
  if (!creep.memory.routing.targetId) {
    // TODO check when this happens and fix it
    creep.log('creep_reserver.action No targetId !!!!!!!!!!!' + JSON.stringify(creep.memory));
    if (creep.room.name === creep.memory.routing.targetRoom) {
      creep.memory.routing.targetId = creep.room.controller.id;
    }
  }

  // TODO this should be enabled, because the reserver should flee without being attacked
  creep.notifyWhenAttacked(false);

  creep.handleReserver();
  return true;
};

roles.reserver.execute = function(creep) {
  creep.log('Execute!!!');
};
