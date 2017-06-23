'use strict';

/*
 * quester checks if quests are solved
 */

roles.quester = {};
roles.quester.settings = {
  layoutString: 'M',
  maxLayoutAmount: 1,
};

roles.quester.action = function(creep) {
  creep.setNextSpawn();
  creep.spawnReplacement();

  let quest = Memory.quests[creep.memory.level];

  if (quest.quest == 'buildcs') {
    // Give time before end to build the last CS
    if (quest.end - Game.time > 300) {
      let cs = creep.room.find(FIND_CONSTRUCTION_SITES);
      if (cs.length === 0) {
        creep.pos.createConstructionSite(STRUCTURE_ROAD);
      }
    }
    if (quest.end < Game.time) {
      let cs = creep.room.find(FIND_CONSTRUCTION_SITES);

      if (cs.length > 0) {
        creep.log(`Quest lost cs: ${cs.length} ${JSON.stringify(quest)}`);
        delete Memory.quests[creep.memory.level];
        creep.suicide();
        return;
      }

      let roads = creep.room.findPropertyFilter(FIND_STRUCTURES, 'structureType', [STRUCTURE_ROAD]);
      if (roads.length < 3) {
        creep.log(`Quest lost roads: ${roads.length} ${JSON.stringify(quest)}`);
        delete Memory.quests[creep.memory.level];
        creep.suicide();
        return;
      }

      let name = quest.player.name;
      brain.initPlayer();
      Memory.players[name].reputation = Memory.players[name].reputation || 0;
      Memory.players[name].reputation += 100;

      creep.log(`Quest won: ${JSON.stringify(quest)}`);
      let response = {
        type: 'Quest',
        id: quest.id,
        reputation: Memory.players[name].reputation,
        result: 'won'
      };
      let room = Game.rooms[quest.origin];
      room.terminal.send(RESOURCE_ENERGY, 100, quest.player.room, JSON.stringify(response));
      delete Memory.quests[creep.memory.level];
      creep.suicide();
      return;
    }
  }

  creep.moveRandom();
  return true;
};
