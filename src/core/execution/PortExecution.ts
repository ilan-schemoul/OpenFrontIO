import { BuildValidator } from "../game/BuildValidator";
import { AllPlayers, BuildItem, BuildItems, Cell, Execution, MutableGame, MutablePlayer, MutableUnit, Player, PlayerID, UnitType } from "../game/Game";
import { bfs, dist, manhattanDist } from "../Util";

export class PortExecution implements Execution {

    private active = true
    private mg: MutableGame
    private player: MutablePlayer
    private port: MutableUnit

    constructor(
        private _owner: PlayerID,
        private cell: Cell
    ) { }


    init(mg: MutableGame, ticks: number): void {
        this.mg = mg
        this.player = mg.player(this._owner)
    }

    tick(ticks: number): void {
        if (this.port == null) {
            const tile = this.mg.tile(this.cell)
            if (!new BuildValidator(this.mg).canBuild(this.player, tile, BuildItems.Port)) {
                console.warn(`player ${this.player} cannot build port at ${this.cell}`)
                this.active = false
                return
            }
            const spawns = Array.from(bfs(tile, dist(tile, 20)))
                .filter(t => t.isOceanShore() && t.owner() == this.player)
                .sort((a, b) => manhattanDist(a.cell(), tile.cell()) - manhattanDist(b.cell(), tile.cell()))

            if (spawns.length == 0) {
                console.warn(`cannot find spawn for port`)
                this.active = false
                return
            }
            this.port = this.player.addUnit(UnitType.Port, 0, spawns[0])
        }
        if (!this.port.tile().hasOwner()) {
            this.port.delete()
            this.active = false
            return
        }
        if (this.port.tile().owner() != this.port.owner()) {
            this.port.setOwner(this.port.tile().owner() as Player)
        }
    }

    owner(): MutablePlayer {
        return null
    }

    isActive(): boolean {
        return this.active
    }

    activeDuringSpawnPhase(): boolean {
        return false
    }

}