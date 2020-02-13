/*
 * Copyright (C) 2017-2019 HERE Europe B.V.
 * Licensed under Apache 2.0, see full license in LICENSE
 * SPDX-License-Identifier: Apache-2.0
 */
import {
    DecodedTile,
    GeometryKind,
    GeometryKindSet,
    isExtrudedLineTechnique,
    isExtrudedPolygonTechnique,
    isFillTechnique,
    isLineMarkerTechnique,
    isLineTechnique,
    isPoiTechnique,
    isSegmentsTechnique,
    isSolidLineTechnique,
    isTextTechnique,
    Technique
} from "@here/harp-datasource-protocol";
import { PerformanceTimer } from "@here/harp-utils";

import { PerformanceStatistics } from "../Statistics";
import { Tile } from "../Tile";
import { TileGeometryCreator } from "./TileGeometryCreator";

/**
 * Loads the geometry for its [[Tile]]. Derived classes allow for different loading strategies.
 */
export interface TileGeometryLoader {
    /**
     * The [[Tile]] this `TileGeometryLoader` is managing.
     */
    tile: Tile;

    /**
     * `True` if all geometry of the `Tile` has been loaded and the loading process is finished.
     */
    isFinished: boolean;

    /**
     * `True` if the basic geometry has been loaded, and the `Tile` is ready  for display.
     */
    basicGeometryLoaded: boolean;

    /**
     * `True` if all geometry of the `Tile` has been loaded.
     */
    allGeometryLoaded: boolean;

    /**
     * The kinds of geometry stored in this [[Tile]].

     */
    availableGeometryKinds: GeometryKindSet | undefined;

    /**
     * Start with or continue with loading geometry. Called repeatedly until `isFinished` is `true`.
     */
    update(
        enabledKinds: GeometryKindSet | undefined,
        disabledKinds: GeometryKindSet | undefined
    ): void;

    /**
     * Dispose of any resources.
     */
    dispose(): void;

    /**
     * Reset the loader to its initial state and cancels any asynchronous work.
     */
    reset(): void;
}

export namespace TileGeometryLoader {
    /**
     * Make sure that all technique have their geometryKind set, either from the theme or their
     * default value.
     *
     * Also gather set of the [[GeometryKind]]s found in the techniques and return it.
     *
     * @param {DecodedTile} decodedTile
     * @returns {GeometryKindSet} The set of kinds used in the decodeTile.
     */
    export function prepareDecodedTile(decodedTile: DecodedTile): GeometryKindSet {
        const foundSet: GeometryKindSet = new GeometryKindSet();

        for (const technique of decodedTile.techniques) {
            let geometryKind = technique.kind;

            // Set default kind based on technique.
            if (geometryKind === undefined) {
                geometryKind = setDefaultGeometryKind(technique);
            }

            if (Array.isArray(geometryKind)) {
                geometryKind = new GeometryKindSet(geometryKind);
            }

            if (geometryKind instanceof Set) {
                for (const kind of geometryKind) {
                    foundSet.add(kind);
                }
            } else {
                foundSet.add(geometryKind);
            }
        }
        return foundSet;
    }

    /**
     * Make sure that the technique has its geometryKind set, either from the theme or their default
     * value.
     *
     * @param {Technique} technique
     */
    export function setDefaultGeometryKind(technique: Technique): GeometryKind | GeometryKindSet {
        let geometryKind = technique.kind;

        // Set default kind based on technique.
        if (geometryKind === undefined) {
            if (isFillTechnique(technique)) {
                geometryKind = GeometryKind.Area;
            } else if (
                isLineTechnique(technique) ||
                isSolidLineTechnique(technique) ||
                isSegmentsTechnique(technique) ||
                isExtrudedLineTechnique(technique)
            ) {
                geometryKind = GeometryKind.Line;
            } else if (isExtrudedPolygonTechnique(technique)) {
                geometryKind = GeometryKind.Building;
            } else if (
                isPoiTechnique(technique) ||
                isLineMarkerTechnique(technique) ||
                isTextTechnique(technique)
            ) {
                geometryKind = GeometryKind.Label;
            } else {
                geometryKind = GeometryKind.All;
            }

            technique.kind = geometryKind;
        }

        return geometryKind;
    }
}

/**
 * Simplest implementation of a [[TileGeometryLoader]]. It loads all geometry in a single step.
 */
export class SimpleTileGeometryLoader implements TileGeometryLoader {
    private m_decodedTile?: DecodedTile;
    private m_isFinished: boolean = false;
    private m_availableGeometryKinds: GeometryKindSet | undefined;
    private m_enabledKinds: GeometryKindSet | undefined;
    private m_disabledKinds: GeometryKindSet | undefined;
    private m_timeout: any;

    constructor(private m_tile: Tile) {}

    get tile(): Tile {
        return this.m_tile;
    }

    get isFinished(): boolean {
        return this.m_isFinished;
    }

    get isLoading(): boolean {
        return this.m_timeout !== undefined;
    }

    get basicGeometryLoaded(): boolean {
        return this.m_tile.hasGeometry;
    }

    get allGeometryLoaded(): boolean {
        return this.m_isFinished;
    }

    /**
     * Set the [[DecodedTile]] of the tile. Is called after the decoded tile has been loaded, and
     * prepares its content for later processing in the 'updateXXX' methods.
     *
     * @param {DecodedTile} decodedTile The decoded tile with the flat geometry data belonging to
     *      this tile.
     * @returns {DecodedTile} The processed decoded tile.
     */
    setDecodedTile(decodedTile: DecodedTile): DecodedTile {
        this.m_decodedTile = decodedTile;

        if (this.m_decodedTile !== undefined) {
            this.m_availableGeometryKinds = TileGeometryLoader.prepareDecodedTile(
                this.m_decodedTile
            );
        }
        return this.m_decodedTile;
    }

    get availableGeometryKinds(): GeometryKindSet | undefined {
        return this.m_availableGeometryKinds;
    }

    update(
        enabledKinds: GeometryKindSet | undefined,
        disabledKinds: GeometryKindSet | undefined
    ): void {
        const tile = this.tile;

        // Geometry kinds have changed if so reset entire loading thus this geometry creator
        // generates all geometry at once.
        if (!this.compareGeometryKinds(enabledKinds, disabledKinds)) {
            this.reset();

            if (enabledKinds !== undefined) {
                this.m_enabledKinds = Object.assign(new GeometryKindSet(), enabledKinds);
            }
            if (disabledKinds !== undefined) {
                this.m_disabledKinds = Object.assign(new GeometryKindSet(), disabledKinds);
            }
        }

        // First time this tile is handled:
        if (this.m_decodedTile === undefined && tile.decodedTile !== undefined && !this.isLoading) {
            TileGeometryCreator.instance.processTechniques(
                tile.decodedTile,
                enabledKinds,
                disabledKinds
            );

            this.setDecodedTile(tile.decodedTile);
            this.prepareForRender(enabledKinds, disabledKinds);
        }
        // TODO: Otherwise we could also check for tile disposal, invisibility moving the block
        // prepareForRender

    }

    dispose(): void {
        this.m_decodedTile = undefined;
        // TODO: Release other resource: availableGeometryKind, enabled/disabled sets, timeout?
    }

    reset(): void {
        this.m_decodedTile = undefined;
        this.m_isFinished = false;
        if (this.m_availableGeometryKinds !== undefined) {
            this.m_availableGeometryKinds.clear();
        }
        this.m_enabledKinds = undefined;
        this.m_disabledKinds = undefined;

        if (this.m_timeout !== undefined) {
            clearTimeout(this.m_timeout);
            this.m_timeout = undefined;
        }
    }

    private finish() {
        // TODO: Would be easier to set m_decodedTile = undefined, then isLoading would check its
        // value and if m_timeout is set.
        this.m_tile.loadingFinished();
        this.m_tile.removeDecodedTile();
        this.m_isFinished = true;
        this.m_timeout = undefined;
    }

    /**
     * Called by [[VisibleTileSet]] to mark that [[Tile]] is visible and it should prepare geometry.
     */
    private prepareForRender(
        enabledKinds: GeometryKindSet | undefined,
        disabledKinds: GeometryKindSet | undefined
    ) {
        if (this.isFinished) {
            return;
        }
        // If the tile is not ready for display, or if it has become invisible while being loaded,
        // for example by moving the camera, the tile is not finished and its geometry is not
        // created. This is an optimization for fast camera movements and zooms.
        const tile = this.tile;
        const decodedTile = this.m_decodedTile;
        this.m_decodedTile = undefined;
        // TODO: Entire block could be moved to update method
        if (decodedTile === undefined || tile.disposed || !tile.isVisible) {
            // TODO: Should we clearTimer here?
            if (this.m_timeout !== undefined) {
                clearTimeout(this.m_timeout);
            }
            // TODO: Should we dispose tile here?
            //if (!tile.isVisible) {
            //    tile.mapView.visibleTileSet.disposeTile(tile);
            //}
            this.finish();
            return;
        }
        // TODO: This should be leaved here if we decide to leave above code block in
        // prepareForRender() then isLoading will not be checked in update() call.
        if (this.isLoading) {
            return;
        }
        this.m_timeout = setTimeout(() => {
            const stats = PerformanceStatistics.instance;
            // If the tile has become invisible while being loaded, for example by moving the
            // camera, the tile is not finished and its geometry is not created. This is an
            // optimization for fast camera movements and zooms.
            if (!tile.isVisible) {
                // Dispose the tile from the visible set, so it can be reloaded properly next time
                // it is needed.
                tile.mapView.visibleTileSet.disposeTile(tile);

                if (stats.enabled) {
                    stats.currentFrame.addMessage(
                        // tslint:disable-next-line: max-line-length
                        `Decoded tile: ${tile.dataSource.name} # lvl=${tile.tileKey.level} col=${tile.tileKey.column} row=${tile.tileKey.row} DISCARDED - invisible`
                    );
                }
                this.finish();
                return;
            }
            // TODO: We should ignore disposed tile here, wright?
            if (tile.disposed) {
                this.finish();
                return;
            }

            let now = 0;
            if (stats.enabled) {
                now = PerformanceTimer.now();
            }

            const geometryCreator = TileGeometryCreator.instance;

            tile.clear();
            // Set up techniques which should be processed.
            geometryCreator.initDecodedTile(decodedTile, enabledKinds, disabledKinds);

            geometryCreator.createAllGeometries(tile, decodedTile);

            if (stats.enabled) {
                const geometryCreationTime = PerformanceTimer.now() - now;
                const currentFrame = stats.currentFrame;
                currentFrame.addValue("geometry.geometryCreationTime", geometryCreationTime);
                currentFrame.addValue("geometryCount.numGeometries", decodedTile.geometries.length);
                currentFrame.addValue("geometryCount.numTechniques", decodedTile.techniques.length);
                currentFrame.addValue(
                    "geometryCount.numPoiGeometries",
                    decodedTile.poiGeometries !== undefined ? decodedTile.poiGeometries.length : 0
                );
                currentFrame.addValue(
                    "geometryCount.numTextGeometries",
                    decodedTile.textGeometries !== undefined ? decodedTile.textGeometries.length : 0
                );
                currentFrame.addValue(
                    "geometryCount.numTextPathGeometries",
                    decodedTile.textPathGeometries !== undefined
                        ? decodedTile.textPathGeometries.length
                        : 0
                );
                currentFrame.addValue(
                    "geometryCount.numPathGeometries",
                    decodedTile.pathGeometries !== undefined ? decodedTile.pathGeometries.length : 0
                );
                currentFrame.addMessage(
                    // tslint:disable-next-line: max-line-length
                    `Decoded tile: ${tile.dataSource.name} # lvl=${tile.tileKey.level} col=${tile.tileKey.column} row=${tile.tileKey.row}`
                );
            }
            this.finish();
            tile.dataSource.requestUpdate();
        }, 0);
    }

    /**
     * Compare enabled and disabled geometry kinds with currently set.
     *
     * Method compares input sets with recently used geometry kinds in performance wise
     * manner, taking special care of undefined and zero size sets.
     *
     * @param enabledKinds Set of geometry kinds to be displayed or undefined.
     * @param disabledKinds Set of geometry kinds that won't be rendered.
     * @return `true` only if sets are logically equal, meaning that undefined and empty sets
     * may result in same geometry (techniques kind) beeing rendered.
     */
    private compareGeometryKinds(
        enabledKinds: GeometryKindSet | undefined,
        disabledKinds: GeometryKindSet | undefined
    ): boolean {
        const enabledSame = this.m_enabledKinds === enabledKinds;
        const disabledSame = this.m_disabledKinds === disabledKinds;
        // Same references, no need to compare.
        if (enabledSame && disabledSame) {
            console.log("Update compare - all the same");
            return true;
        }
        const enabledEmpty =
            (this.m_enabledKinds === undefined || this.m_enabledKinds.size === 0) &&
            (enabledKinds === undefined || enabledKinds.size === 0);
        const disabledEmpty =
            (this.m_disabledKinds === undefined || this.m_disabledKinds.size === 0) &&
            (disabledKinds === undefined || disabledKinds.size === 0);

        // We deal only with empty, the same or undefined sets - fast return, no need to compare.
        if (
            (enabledEmpty && disabledEmpty) ||
            (enabledSame && disabledEmpty) ||
            (disabledSame && enabledEmpty)
        ) {
            console.log("Update compare - same or empty");
            return true;
        }
        // It is enough that one the the sets are different, try to spot difference otherwise
        // return true. Compare only non-empty sets.
        if (!enabledEmpty) {
            // If one set undefined then other must be non-empty, for sure different.
            if (enabledKinds === undefined || this.m_enabledKinds === undefined) {
                console.log("Update compare enabled - one defined other not");
                return false;
            }
            // Both defined and non-empty, compare the sets.
            else if (!enabledKinds.has(this.m_enabledKinds)) {
                console.log("Update compare enabled - different sets");
                return false;
            }
        }
        if (!disabledEmpty) {
            // One set defined and non-empty other undefined, for sure different.
            if (disabledKinds === undefined || this.m_disabledKinds === undefined) {
                console.log("Update compare enabled - one defined other not");
                return false;
            }
            // Both defined and non-empty, compare the sets.
            else if (!disabledKinds.has(this.m_disabledKinds)) {
                console.log("Update compare disabled - different sets");
                return false;
            }
        }
        // No difference found.
        console.log("Update compare - no difference found");
        return true;
    }
}
