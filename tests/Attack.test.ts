import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { SpawnExecution } from "../src/core/execution/SpawnExecution";
import { setup } from "./util/Setup";
import { constructionExecution } from "./util/utils";
import { TransportShipExecution } from "../src/core/execution/TransportShipExecution";
import { TileRef } from "../src/core/game/GameMap";
import { AttackExecution } from "../src/core/execution/AttackExecution";
import { TestConfig } from "./util/TestConfig";

let game: Game;
let attacker: Player;
let defender: Player;
let defenderSpawn: TileRef;
let attackerSpawn: TileRef;

function sendBoat(target: TileRef, troops: number) {
  game.addExecution(
    new TransportShipExecution(defender.id(), null, target, troops),
  );
}

describe("Attack", () => {
  beforeEach(async () => {
    game = await setup("ocean_and_land", {
      infiniteGold: true,
      instantBuild: true,
      infiniteTroops: true,
    });
    const attackerInfo = new PlayerInfo(
      "us",
      "attacker dude",
      PlayerType.Human,
      null,
      "attacker_id",
    );
    game.addPlayer(attackerInfo, 1000);
    const defenderInfo = new PlayerInfo(
      "us",
      "defender dude",
      PlayerType.Human,
      null,
      "defender_id",
    );
    game.addPlayer(defenderInfo, 1000);

    defenderSpawn = game.ref(0, 15);
    attackerSpawn = game.ref(0, 10);

    game.addExecution(
      new SpawnExecution(game.player(attackerInfo.id).info(), attackerSpawn),
      new SpawnExecution(game.player(defenderInfo.id).info(), defenderSpawn),
    );

    while (game.inSpawnPhase()) {
      game.executeNextTick();
    }

    attacker = game.player(attackerInfo.id);
    defender = game.player(defenderInfo.id);

    game.addExecution(new AttackExecution(100, defender.id(), null));
    game.executeNextTick();
    while (defender.outgoingAttacks().length > 0) {
      game.executeNextTick();
    }

    (game.config() as TestConfig).setDefaultNukeSpeed(99);
  });

  test("Nuke reduce attacking troop counts", async () => {
    // Not building exactly spawn to it's better protected from attacks (but still
    // on defender territory)
    constructionExecution(game, defender.id(), 1, 1, UnitType.MissileSilo);
    expect(defender.units(UnitType.MissileSilo)).toHaveLength(1);
    game.addExecution(new AttackExecution(100, attacker.id(), defender.id()));
    constructionExecution(game, defender.id(), 0, 15, UnitType.AtomBomb, 3);
    const nuke = defender.units(UnitType.AtomBomb)[0];
    expect(nuke.isActive()).toBe(true);

    expect(attacker.outgoingAttacks()).toHaveLength(1);
    expect(attacker.outgoingAttacks()[0].troops()).toBe(98);

    // Make the nuke go kaboom
    game.executeNextTick();
    expect(nuke.isActive()).toBe(false);
    expect(attacker.outgoingAttacks()[0].troops()).not.toBe(97);
    expect(attacker.outgoingAttacks()[0].troops()).toBeLessThan(90);
  });

  test("Nuke reduce attacking boat troop count", async () => {
    constructionExecution(game, defender.id(), 1, 1, UnitType.MissileSilo);
    expect(defender.units(UnitType.MissileSilo)).toHaveLength(1);

    sendBoat(game.ref(15, 8), 100);

    constructionExecution(game, defender.id(), 0, 15, UnitType.AtomBomb, 3);
    const nuke = defender.units(UnitType.AtomBomb)[0];
    expect(nuke.isActive()).toBe(true);

    const ship = defender.units(UnitType.TransportShip)[0];
    expect(ship.troops()).toBe(100);

    game.executeNextTick();

    expect(nuke.isActive()).toBe(false);
    expect(defender.units(UnitType.TransportShip)[0].troops()).toBeLessThan(90);
  });
});
