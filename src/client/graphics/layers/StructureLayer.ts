import { colord, Colord } from "colord";
import { Theme } from "../../../core/configuration/Config";
import { Unit, Cell, Game, Tile, UnitType } from "../../../core/game/Game";
import { bfs, dist, euclDist } from "../../../core/Util";
import { Layer } from "./Layer";
import { EventBus } from "../../../core/EventBus";

import anchorIcon from '../../../../resources/images/AnchorIcon.png';
import missileSiloIcon from '../../../../resources/images/MissileSiloUnit.png';
import shieldIcon from '../../../../resources/images/ShieldIcon.png';
import cityIcon from '../../../../resources/images/CityIcon.png';
import { GameView } from "../../../core/GameView";

interface UnitRenderConfig {
    icon: string;
    borderRadius: number;
    territoryRadius: number;
}


export class StructureLayer implements Layer {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private unitImages: Map<string, HTMLImageElement> = new Map();
    private theme: Theme = null;

    private seenUnits = new Set<Unit>()

    // Configuration for supported unit types only
    private readonly unitConfigs: Partial<Record<UnitType, UnitRenderConfig>> = {
        [UnitType.Port]: {
            icon: anchorIcon,
            borderRadius: 8,
            territoryRadius: 6
        },
        [UnitType.MissileSilo]: {
            icon: missileSiloIcon,
            borderRadius: 8,
            territoryRadius: 6
        },
        [UnitType.DefensePost]: {
            icon: shieldIcon,
            borderRadius: 8,
            territoryRadius: 6
        },
        [UnitType.City]: {
            icon: cityIcon,
            borderRadius: 8,
            territoryRadius: 6
        }
    };

    constructor(private game: GameView, private eventBus: EventBus) {
        this.theme = game.config().theme();
        this.loadUnitImages();
    }

    private loadUnitImages() {
        Object.entries(this.unitConfigs).forEach(([unitType, config]) => {
            const image = new Image();
            image.src = config.icon;
            image.onload = () => {
                this.unitImages.set(unitType, image);
            };
        });
    }

    shouldTransform(): boolean {
        return true;
    }

    tick() {
        this.game.units().forEach(u => this.handleUnitRendering(u))
    }

    init() {
        this.redraw()
    }

    redraw() {
        console.log('structure layer redrawing')
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext("2d", { alpha: true });
        this.canvas.width = this.game.width();
        this.canvas.height = this.game.height();
        this.game.units().forEach(u => this.handleUnitRendering(u))
    }

    renderLayer(context: CanvasRenderingContext2D) {
        context.drawImage(
            this.canvas,
            -this.game.width() / 2,
            -this.game.height() / 2,
            this.game.width(),
            this.game.height()
        );
    }

    private isUnitTypeSupported(unitType: UnitType): boolean {
        return unitType in this.unitConfigs;
    }

    private handleUnitRendering(unit: Unit) {
        const unitType = unit.type();
        if (!this.isUnitTypeSupported(unitType)) return;

        if (unit.isActive() && this.seenUnits.has(unit)) {
            // Already rendered, so don't do anything.
            return
        }
        if (!unit.isActive() && !this.seenUnits.has(unit)) {
            // Has been deleted and render is cleared so don't do anything.
            return
        }

        const config = this.unitConfigs[unitType];
        const unitImage = this.unitImages.get(unitType);

        if (!config || !unitImage) return;

        // Clear previous rendering
        bfs(unit.tile(), euclDist(unit.tile(), config.borderRadius))
            .forEach(t => this.clearCell(t.cell()));

        if (!unit.isActive()) {
            this.seenUnits.delete(unit)
            return;
        }
        this.seenUnits.add(unit)

        // Create temporary canvas for icon processing
        const tempCanvas = document.createElement('canvas');
        const tempContext = tempCanvas.getContext('2d');
        tempCanvas.width = unitImage.width;
        tempCanvas.height = unitImage.height;

        // Draw the unit icon
        tempContext.drawImage(unitImage, 0, 0);
        const iconData = tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

        const cell = unit.tile().cell();
        const startX = cell.x - Math.floor(tempCanvas.width / 2);
        const startY = cell.y - Math.floor(tempCanvas.height / 2);

        // Draw border and territory
        bfs(unit.tile(), euclDist(unit.tile(), config.borderRadius))
            .forEach(t => this.paintCell(t.cell(), this.theme.borderColor(unit.owner().info()), 255));

        bfs(unit.tile(), euclDist(unit.tile(), config.territoryRadius))
            .forEach(t => this.paintCell(t.cell(), this.theme.territoryColor(unit.owner().info()), 130));

        // Draw the icon
        this.renderIcon(iconData, startX, startY, tempCanvas.width, tempCanvas.height, unit);
    }

    private renderIcon(
        iconData: ImageData,
        startX: number,
        startY: number,
        width: number,
        height: number,
        unit: Unit
    ) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const iconIndex = (y * width + x) * 4;
                const alpha = iconData.data[iconIndex + 3];

                if (alpha > 0) {
                    const targetX = startX + x;
                    const targetY = startY + y;

                    if (targetX >= 0 && targetX < this.game.width() &&
                        targetY >= 0 && targetY < this.game.height()) {
                        this.paintCell(
                            new Cell(targetX, targetY),
                            this.theme.borderColor(unit.owner().info()),
                            alpha
                        );
                    }
                }
            }
        }
    }

    paintCell(cell: Cell, color: Colord, alpha: number) {
        this.clearCell(cell)
        this.context.fillStyle = color.alpha(alpha / 255).toRgbString();
        this.context.fillRect(cell.x, cell.y, 1, 1);
    }

    clearCell(cell: Cell) {
        this.context.clearRect(cell.x, cell.y, 1, 1);
    }
}