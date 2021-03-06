'use strict';

/*
 * scout moves around to provide visibility
 *
 * Pre observer the scout moves through surrounding rooms
 */

roles.scout = {};
roles.scout.settings = {
  layoutString: 'M',
  amount: [1],
  maxLayoutAmount: 1,
};

function onBorder(creep) {
  return creep.pos.x === 49 || creep.pos.x === 0 ||
    creep.pos.y === 49 || creep.pos.y === 0;
}

function haveNotSeen(creep, room) {
  return creep.memory.search.seen.indexOf(room) === -1 &&
    creep.memory.skip.indexOf(room) === -1;
}

function checkForDefender(creep) {
  if (!creep.room.controller) {
    return false;
  }
  if (!creep.room.controller.reservation) {
    return false;
  }
  if (creep.room.controller.reservation.username === Memory.username) {
    return false;
  }
  if (!config.external.defendDistance) {
    return false;
  }

  const distance = Game.map.getRoomLinearDistance(creep.room.name, creep.memory.base);
  if (distance > config.external.defendDistance) {
    return false;
  }

  creep.log('Spawning defender for external room');
  Game.rooms[creep.memory.base].checkRoleToSpawn('defender', 1, undefined, creep.room.name);
}

roles.scout.execute = function(creep) {
  if (creep.memory.skip === undefined) {
    creep.memory.skip = [];
  }
  const breadthFirstSearch = function(creep) {
    const setNewTarget = function(creep) {
      for (const room of creep.memory.search.levels[creep.memory.search.level]) {
        if (haveNotSeen(creep, room)) {
          creep.memory.search.target = room;
          return true;
        }
      }
      return false;
    };
    let setNewLevel = function(creep) {
      creep.memory.search.levels.push([]);
      for (let room of creep.memory.search.levels[creep.memory.search.level]) {
        let rooms = Game.map.describeExits(room);
        for (let direction in rooms) {
          let roomNext = rooms[direction];
          if (haveNotSeen(creep, roomNext) && Game.map.isRoomAvailable(roomNext)) {
            creep.memory.search.levels[creep.memory.search.level + 1].push(roomNext);
            creep.memory.search.target = roomNext;
          }
        }
      }
      creep.memory.search.level++;
    };

    if (!creep.memory.search) {
      creep.memory.search = {};
      creep.memory.search.seen = [creep.room.name];
      creep.memory.search.level = 0;
      creep.memory.search.levels = [
        [creep.room.name],
      ];
      setNewLevel(creep);
    }

    if (creep.memory.scoutSkip || creep.room.name === creep.memory.search.target) {
      if (creep.memory.scoutSkip) {
        creep.memory.skip.push(creep.memory.search.target);
        delete creep.memory.scoutSkip;
      } else {
        checkForDefender(creep);
        creep.memory.search.seen.push(creep.room.name);
      }
      if (!setNewTarget(creep)) {
        setNewLevel(creep);
        if (creep.memory.search.levels[creep.memory.search.level].length == 0) {
          delete creep.memory.search.target;
        }
      }
    }

    if (!creep.memory.search.target) {
      creep.log('Suiciding: ' + JSON.stringify(creep.memory.search));
      creep.suicide();
      return true;
    }
    const targetPosObject = new RoomPosition(25, 25, creep.memory.search.target);

    let search;

    try {
      search = PathFinder.search(
        creep.pos, {
          pos: targetPosObject,
          range: 20,
        }, {
          roomCallback: creep.room.getCostMatrixCallback(targetPosObject, true, false, true),
        }
      );

      if (config.visualizer.enabled && config.visualizer.showPathSearches) {
        visualizer.showSearch(search);
      }
    } catch (e) {
      if (e !== null) {
        creep.log(`search: ${targetPosObject} ${e} ${e.stack}`);
      } else {
        creep.log(`search: ${targetPosObject} ${e}`);
      }
      // creep.memory.search.seen.push(creep.memory.search.target);
      // // TODO extract to a method
      // if (!setNewTarget(creep)) {
      //   creep.memory.search.levels.push([]);
      //   for (let room of creep.memory.search.levels[creep.memory.search.level]) {
      //     let rooms = Game.map.describeExits(room);
      //     for (let direction in rooms) {
      //       let roomNext = rooms[direction];
      //       if (haveNotSeen(creep, roomNext)) {
      //         creep.memory.search.levels[creep.memory.search.level + 1].push(roomNext);
      //         creep.memory.search.target = roomNext;
      //       }
      //     }
      //   }
      //   creep.memory.search.level++;
      // }
      return false;
    }

    if (creep.memory.last && creep.memory.last.pos3 && creep.pos.roomName !== creep.memory.last.pos3.roomName) {
      creep.moveTo(25, 25);
      return true;
    }

    if (creep.isStuck()) {
      creep.moveRandom();
      creep.say('ImStuck', true);
      creep.log('Scout Stuck, Randomly Moving: ' + JSON.stringify(creep.memory.last) + ' ' + JSON.stringify(creep.isStuck()));
      return true;
    }

    if (search.path.length === 0 || (creep.inBase() && creep.room.memory.misplacedSpawn)) {
      creep.say('hello', true);
      //       creep.log(creep.pos + ' ' + targetPosObject + ' ' + JSON.stringify(search));
      if (creep.isStuck() && onBorder(creep)) {
        creep.say('imstuck at the border', true);
        if (config.room.scoutSkipWhenStuck) {
          creep.say('skipping', true);
          creep.memory.scoutSkip = true;
          delete creep.memory.last; // Delete to reset stuckness.
        }
      }
      // if (search.path.length > 0) {
      // creep.move(creep.pos.getDirectionTo(search.path[0]));
      // } else {
      creep.moveTo(targetPosObject, {
        ignoreCreeps: true,
        costCallback: creep.room.getCostMatrixCallback(),
      });
      // }
      return true;
    }
    creep.say(creep.pos.getDirectionTo(search.path[0]));
    creep.move(creep.pos.getDirectionTo(search.path[0]));
  };

  creep.notifyWhenAttacked(false);
  return breadthFirstSearch(creep);
};
