import { GameUpdateType, MapPos, MessageType, NameViewData, Player, PlayerActions, PlayerUpdate, Tile, TileUpdate, Unit, UnitUpdate } from './game/Game';
import { Config } from "./configuration/Config";
import { Alliance, AllianceRequest, AllPlayers, Cell, DefenseBonus, EmojiMessage, Execution, ExecutionView, Game, Gold, MutableTile, Nation, PlayerID, PlayerInfo, PlayerType, Relation, TerrainMap, TerrainTile, TerrainType, TerraNullius, Tick, UnitInfo, UnitType } from "./game/Game";
import { ClientID } from "./Schemas";
import { TerraNulliusImpl } from './game/TerraNulliusImpl';
import { WorkerClient } from './worker/WorkerClient';


export class TileView {

    private _neighbors: TileView[] = []

    constructor(private game: GameView, public data: TileUpdate, private _terrain: TerrainTile) { }

    type(): TerrainType {
        return this._terrain.type()
    }
    owner(): PlayerView | TerraNullius {
        if (!this.hasOwner()) {
            return new TerraNulliusImpl()
        }
        return this.game.playerBySmallID(this.data?.ownerID)
    }
    hasOwner(): boolean {
        return this.data?.ownerID !== undefined && this.data.ownerID !== 0;
    }
    isBorder(): boolean {
        for (const n of this.neighbors()) {
            if (n.data?.ownerID != this.data?.ownerID) {
                return true
            }
        }
        return false
    }
    cell(): Cell {
        return this._terrain.cell()
    }
    hasFallout(): boolean {
        return this.data?.hasFallout
    }
    terrain(): TerrainTile {
        return this._terrain
    }

    neighbors(): TileView[] {
        if (this._neighbors.length == 0) {
            this._neighbors = this._terrain.neighbors().map(t => this.game.tile(t.cell()))
        }
        return this._neighbors
    }

    hasDefenseBonus(): boolean {
        return this.data?.hasDefenseBonus ?? false
    }
    cost(): number {
        return this._terrain.cost()
    }
}

export class UnitView implements Unit {
    constructor(private gameView: GameView, private data: UnitUpdate) { }

    lastTile(): Tile {
        return this.gameView.tile(new Cell(this.data.lastPos.x, this.data.lastPos.y))
    }

    update(data: UnitUpdate) {
        this.data = data
    }

    id(): number {
        return this.data.id
    }

    type(): UnitType {
        return this.data.unitType
    }
    troops(): number {
        return this.data.troops
    }
    tile(): Tile {
        return this.gameView.tile(new Cell(this.data.pos.x, this.data.pos.y))
    }
    owner(): PlayerView {
        return this.gameView.playerBySmallID(this.data.ownerID)
    }
    isActive(): boolean {
        return this.data.isActive
    }
    hasHealth(): boolean {
        return this.data.health != undefined
    }
    health(): number {
        return this.data.health ?? 0
    }
}

export class PlayerView implements Player {
    constructor(private game: GameView, public data: PlayerUpdate) { }

    async actions(tile: Tile): Promise<PlayerActions> {
        return this.game.worker.playerInteraction(this.id(), tile)
    }

    nameLocation(): NameViewData {
        return this.data.nameViewData
    }

    smallID(): number {
        return this.data.smallID
    }
    lastTileChange(): Tick {
        return 0
    }
    name(): string {
        return this.data.name
    }
    displayName(): string {
        return this.data.displayName
    }
    clientID(): ClientID {
        return this.data.clientID
    }
    id(): PlayerID {
        return this.data.id
    }
    type(): PlayerType {
        return this.data.playerType
    }
    isAlive(): boolean {
        return this.data.isAlive
    }
    isPlayer(): this is Player {
        return true
    }
    numTilesOwned(): number {
        return this.data.tilesOwned
    }
    allies(): Player[] {
        return this.data.allies.map(a => this.game.player(a))
    }
    gold(): Gold {
        return this.data.gold
    }
    population(): number {
        return this.data.population
    }
    workers(): number {
        return this.data.workers
    }
    targetTroopRatio(): number {
        return this.data.targetTroopRatio
    }
    troops(): number {
        return this.data.troops
    }

    isAlliedWith(other: Player): boolean {
        return false
    }
    allianceWith(other: Player): Alliance | null {
        return null
    }
    borderTiles(): ReadonlySet<Tile> {
        return new Set()
    }
    units(...types: UnitType[]): Unit[] {
        return []
    }
    sharesBorderWith(other: Player | TerraNullius): boolean {
        return false
    }

    incomingAllianceRequests(): AllianceRequest[] {
        return []
    }
    outgoingAllianceRequests(): AllianceRequest[] {
        return []
    }
    alliances(): Alliance[] {
        return []
    }
    recentOrPendingAllianceRequestWith(other: Player): boolean {
        return false
    }
    relation(other: Player): Relation {
        return Relation.Neutral
    }
    allRelationsSorted(): { player: Player; relation: Relation; }[] {
        return []
    }
    transitiveTargets(): Player[] {
        return []
    }
    isTraitor(): boolean {
        return false
    }
    canTarget(other: Player): boolean {
        return false
    }
    toString(): string {
        return ''
    }
    canSendEmoji(recipient: Player | typeof AllPlayers): boolean {
        return false
    }
    outgoingEmojis(): EmojiMessage[] {
        return []
    }
    canDonate(recipient: Player): boolean {
        return false
    }
    canBuild(type: UnitType, targetTile: Tile): Tile | false {
        return false
    }
    info(): PlayerInfo {
        return new PlayerInfo(this.name(), this.type(), this.clientID(), this.id())
    }
}

export interface GameUpdateViewData {
    tick: number
    units: UnitUpdate[]
    players: Record<PlayerID, PlayerUpdate>
    packedTileUpdates: Uint16Array[]
}

export class GameView {
    private lastUpdate: GameUpdateViewData
    private tiles: TileView[][] = []
    private smallIDToID = new Map<number, PlayerID>()
    private _players = new Map<PlayerID, PlayerView>()
    private _units = new Map<number, UnitView>()
    private updatedTiles: TileView[] = []
    private updatedUnits: UnitView[] = []

    constructor(public worker: WorkerClient, private _config: Config, private _terrainMap: TerrainMap) {
        // Initialize the 2D array
        this.tiles = Array(_terrainMap.width()).fill(null).map(() => Array(_terrainMap.height()).fill(null));

        // Fill the array with new TileView objects
        for (let x = 0; x < _terrainMap.width(); x++) {
            for (let y = 0; y < _terrainMap.height(); y++) {
                this.tiles[x][y] = new TileView(this, null, _terrainMap.terrain(new Cell(x, y)));
            }
        }
        this.lastUpdate = {
            tick: 0,
            units: [],
            packedTileUpdates: [],
            players: {}
        }
    }

    public update(gu: GameUpdateViewData) {
        this.lastUpdate = gu

        const updated = new Set<MapPos>()
        this.lastUpdate.packedTileUpdates.map(tu => unpackTileData(tu)).forEach(tu => {
            this.tiles[tu.pos.x][tu.pos.y].data = tu
            updated.add(tu.pos)
        })
        this.updatedTiles = Array.from(updated).map(pos => this.tiles[pos.x][pos.y])

        Object.entries(gu.players).forEach(([key, value]) => {
            this.smallIDToID.set(value.smallID, key);
            if (this._players.has(key)) {
                this._players.get(key).data = value
            } else {
                this._players.set(key, new PlayerView(this, value))
            }
        });
        gu.units.forEach(unit => {
            if (this._units.has(unit.id)) {
                this._units.get(unit.id).update(unit)
            } else {
                this._units.set(unit.id, new UnitView(this, unit))
            }
        })
        this.updatedUnits = gu.units.map(u => this._units.get(u.id))
    }

    recentlyUpdatedTiles(): TileView[] {
        return this.updatedTiles
    }
    recentlyUpdatedUnits(): UnitView[] {
        return this.updatedUnits
    }

    player(id: PlayerID): PlayerView {
        if (this._players.has(id)) {
            return this._players.get(id)
        }
        throw Error(`player id ${id} not found`)
    }

    playerBySmallID(id: number): PlayerView {
        if (!this.smallIDToID.has(id)) {
            throw new Error(`small id ${id} not found`)
        }
        return this.player(this.smallIDToID.get(id))
    }

    playerByClientID(id: ClientID): PlayerView | null {
        const player = Array.from(this._players.values()).filter(p => p.clientID() == id)[0] ?? null
        if (player == null) {
            return null
        }
        return player
    }
    hasPlayer(id: PlayerID): boolean {
        return false
    }
    playerViews(): PlayerView[] {
        return Array.from(this._players.values())
    }

    players(): Player[] {
        return []
    }
    tile(cell: Cell): TileView {
        return this.tiles[cell.x][cell.y]
    }
    isOnMap(cell: Cell): boolean {
        return this._terrainMap.isOnMap(cell)
    }
    width(): number {
        return this._terrainMap.width()
    }
    height(): number {
        return this._terrainMap.height()
    }

    forEachTile(fn: (tile: Tile) => void): void {
        for (let x = 0; x < this._terrainMap.width(); x++) {
            for (let y = 0; y < this._terrainMap.height(); y++) {
                fn(this.tile(new Cell(x, y)))
            }
        }
    }
    ticks(): Tick {
        return this.lastUpdate.tick
    }
    inSpawnPhase(): boolean {
        return this.lastUpdate.tick <= this._config.numSpawnPhaseTurns()
    }
    config(): Config {
        return this._config
    }
    units(...types: UnitType[]): Unit[] {
        return Array.from(this._units.values())
    }
    unitInfo(type: UnitType): UnitInfo {
        return this._config.unitInfo(type)
    }
    terrainMap(): TerrainMap {
        return this._terrainMap
    }
}

export function packTileData(tile: TileUpdate): Uint16Array {
    const packed = new Uint16Array(4);
    packed[0] = tile.pos.x;
    packed[1] = tile.pos.y;
    packed[2] = tile.ownerID;

    // Pack booleans into bits
    packed[3] = (tile.hasFallout ? 1 : 0) |
        (tile.hasDefenseBonus ? 2 : 0) |
        (tile.isBorder ? 4 : 0)

    return packed;
}

export function unpackTileData(packed: Uint16Array): TileUpdate {
    return {
        type: GameUpdateType.Tile,
        pos: {
            x: packed[0],
            y: packed[1],
        },
        ownerID: packed[2],
        hasFallout: !!(packed[3] & 1),
        hasDefenseBonus: !!(packed[3] & 2),
        isBorder: !!(packed[3] & 4),
    };
}