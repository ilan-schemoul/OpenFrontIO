import { GameUpdates, GameUpdateType, MapPos, MessageType, NameViewData, Player, PlayerActions, PlayerProfile, PlayerUpdate, Unit, UnitUpdate } from './game/Game';
import { Config } from "./configuration/Config";
import { Alliance, AllianceRequest, AllPlayers, Cell, DefenseBonus, EmojiMessage, Execution, ExecutionView, Game, Gold, Nation, PlayerID, PlayerInfo, PlayerType, Relation, TerrainType, TerraNullius, Tick, UnitInfo, UnitType } from "./game/Game";
import { ClientID } from "./Schemas";
import { TerraNulliusImpl } from './game/TerraNulliusImpl';
import { WorkerClient } from './worker/WorkerClient';
import { GameMap, GameMapImpl, TileRef, TileUpdate } from './game/GameMap';

export class UnitView implements Unit {
    public _wasUpdated = true
    public lastPos: MapPos[] = []

    constructor(private gameView: GameView, private data: UnitUpdate) {
        this.lastPos.push(data.pos)
    }

    wasUpdated(): boolean {
        return this._wasUpdated
    }

    lastTiles(): TileRef[] {
        return this.lastPos.map(pos => this.gameView.ref(pos.x, pos.y))
    }

    lastTile(): TileRef {
        if (this.lastPos.length == 0) {
            return this.gameView.ref(this.data.pos.x, this.data.pos.y)
        }
        return this.gameView.ref(this.lastPos[0].x, this.lastPos[0].y)
    }

    update(data: UnitUpdate) {
        this.lastPos.push(data.pos)
        this._wasUpdated = true
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
    tile(): TileRef {
        return this.gameView.ref(this.data.pos.x, this.data.pos.y)
    }
    owner(): PlayerView {
        return this.gameView.playerBySmallID(this.data.ownerID) as PlayerView
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

    constructor(private game: GameView, public data: PlayerUpdate, public nameData: NameViewData) { }
    borderTiles(): ReadonlySet<TileRef> {
        throw new Error('Method not implemented.');
    }

    async actions(tile: TileRef): Promise<PlayerActions> {
        return this.game.worker.playerInteraction(this.id(), this.game.x(tile), this.game.y(tile))
    }

    nameLocation(): NameViewData {
        return this.nameData
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
        return this.data.alliances.some(n => other.smallID() == n)
    }
    allianceWith(other: Player): Alliance | null {
        return null
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

    profile(): Promise<PlayerProfile> {
        return this.game.worker.playerProfile(this.smallID())
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
    canBuild(type: UnitType, targetTile: TileRef): TileRef | false {
        return false
    }
    info(): PlayerInfo {
        return new PlayerInfo(this.name(), this.type(), this.clientID(), this.id())
    }
}

export interface GameUpdateViewData {
    tick: number
    updates: GameUpdates
    packedTileUpdates: BigUint64Array
    playerNameViewData: Record<number, NameViewData>
}

export class GameView implements GameMap {
    private lastUpdate: GameUpdateViewData
    private smallIDToID = new Map<number, PlayerID>()
    private _players = new Map<PlayerID, PlayerView>()
    private _units = new Map<number, UnitView>()
    private updatedTiles: TileRef[] = []

    constructor(public worker: WorkerClient, private _config: Config, private _map: GameMap) {
        this.lastUpdate = {
            tick: 0,
            packedTileUpdates: new BigUint64Array([]),
            // TODO: make this empty map instead of null?
            updates: null,
            playerNameViewData: {},
        }
    }

    public updatesSinceLastTick(): GameUpdates {
        return this.lastUpdate.updates
    }

    public update(gu: GameUpdateViewData) {
        this.lastUpdate = gu

        this.updatedTiles = []
        this.lastUpdate.packedTileUpdates.forEach(tu => {
            this.updatedTiles.push(this.updateTile(tu))
        })

        gu.updates[GameUpdateType.Player].forEach((pu) => {
            this.smallIDToID.set(pu.smallID, pu.id);
            if (this._players.has(pu.id)) {
                this._players.get(pu.id).data = pu
                this._players.get(pu.id).nameData = gu.playerNameViewData[pu.id]
            } else {
                this._players.set(pu.id, new PlayerView(this, pu, gu.playerNameViewData[pu.id]))
            }
        });
        for (const unit of this._units.values()) {
            unit._wasUpdated = false
            unit.lastPos = unit.lastPos.slice(-1)
        }
        gu.updates[GameUpdateType.Unit].forEach(unit => {
            if (this._units.has(unit.id)) {
                this._units.get(unit.id).update(unit)
            } else {
                this._units.set(unit.id, new UnitView(this, unit))
            }
        })
    }

    recentlyUpdatedTiles(): TileRef[] {
        return this.updatedTiles
    }

    player(id: PlayerID): PlayerView {
        if (this._players.has(id)) {
            return this._players.get(id)
        }
        throw Error(`player id ${id} not found`)
    }

    playerBySmallID(id: number): PlayerView | TerraNullius {
        if (id == 0) {
            return new TerraNulliusImpl()
        }
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

    owner(tile: TileRef): PlayerView | TerraNullius {
        return this.playerBySmallID(this.ownerID(tile))
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
    units(...types: UnitType[]): UnitView[] {
        return Array.from(this._units.values())
    }
    unitInfo(type: UnitType): UnitInfo {
        return this._config.unitInfo(type)
    }

    ref(x: number, y: number): TileRef { return this._map.ref(x, y) }
    x(ref: TileRef): number { return this._map.x(ref) }
    y(ref: TileRef): number { return this._map.y(ref) }
    cell(ref: TileRef): Cell { return this._map.cell(ref) }
    width(): number { return this._map.width() }
    height(): number { return this._map.height() }
    numLandTiles(): number { return this._map.numLandTiles() }
    isValidCoord(x: number, y: number): boolean { return this._map.isValidCoord(x, y) }
    isLand(ref: TileRef): boolean { return this._map.isLand(ref) }
    isOceanShore(ref: TileRef): boolean { return this._map.isOceanShore(ref) }
    isOcean(ref: TileRef): boolean { return this._map.isOcean(ref) }
    isShoreline(ref: TileRef): boolean { return this._map.isShoreline(ref) }
    magnitude(ref: TileRef): number { return this._map.magnitude(ref) }
    ownerID(ref: TileRef): number { return this._map.ownerID(ref) }
    hasOwner(ref: TileRef): boolean { return this._map.hasOwner(ref) }
    setOwnerID(ref: TileRef, playerId: number): void { return this._map.setOwnerID(ref, playerId) }
    hasFallout(ref: TileRef): boolean { return this._map.hasFallout(ref) }
    setFallout(ref: TileRef, value: boolean): void { return this._map.setFallout(ref, value) }
    isBorder(ref: TileRef): boolean { return this._map.isBorder(ref) }
    neighbors(ref: TileRef): TileRef[] { return this._map.neighbors(ref) }
    isWater(ref: TileRef): boolean { return this._map.isWater(ref) }
    isLake(ref: TileRef): boolean { return this._map.isLake(ref) }
    isShore(ref: TileRef): boolean { return this._map.isShore(ref) }
    cost(ref: TileRef): number { return this._map.cost(ref) }
    terrainType(ref: TileRef): TerrainType { return this._map.terrainType(ref) }
    forEachTile(fn: (tile: TileRef) => void): void { return this._map.forEachTile(fn) }
    manhattanDist(c1: TileRef, c2: TileRef): number { return this._map.manhattanDist(c1, c2) }
    euclideanDist(c1: TileRef, c2: TileRef): number { return this._map.euclideanDist(c1, c2) }
    bfs(tile: TileRef, filter: (gm: GameMap, tile: TileRef) => boolean): Set<TileRef> { return this._map.bfs(tile, filter) }
    toTileUpdate(tile: TileRef): bigint { return this._map.toTileUpdate(tile) }
    updateTile(tu: TileUpdate): TileRef { return this._map.updateTile(tu) }
}
