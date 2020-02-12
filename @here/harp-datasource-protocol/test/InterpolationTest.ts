/*
 * Copyright (C) 2017-2019 HERE Europe B.V.
 * Licensed under Apache 2.0, see full license in LICENSE
 * SPDX-License-Identifier: Apache-2.0
 */

// tslint:disable:only-arrow-functions
//    Mocha discourages using arrow functions, see https://mochajs.org/#arrow-functions

import { assert } from "chai";
import { MapEnv } from "../lib/Env";
import {
    createInterpolatedPropertyInt,
    evaluateInterpolatedProperty,
    InterpolatedProperty,
    InterpolatedPropertyParams
} from "../lib/InterpolatedProperty";
import { InterpolationMode } from "../lib/InterpolatedPropertyDefs";
import { StringEncodedNumeralType } from "../lib/StringEncodedNumeral";

const levels = new Float32Array([0, 5, 10]);

const numberPropertyDef: Omit<InterpolatedPropertyParams, "interpolationMode"> = {
    zoomLevels: levels,
    values: [0, 100, 500]
};

const booleanPropertyDef: Omit<InterpolatedPropertyParams, "interpolationMode"> = {
    zoomLevels: levels,
    values: [true, false, true]
};

const colorPropertyDef: Omit<InterpolatedPropertyParams, "interpolationMode"> = {
    zoomLevels: levels,
    // [r0, g0, b0, r1, g1, b1, ...]
    values: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    stringEncodedNumeralType: StringEncodedNumeralType.Hex
};

const enumPropertyDef: Omit<InterpolatedPropertyParams, "interpolationMode"> = {
    zoomLevels: levels,
    values: ["Enum0", "Enum1", "Enum2"]
};

function getInterpolated(property: InterpolatedProperty, zoom: number) {
    return evaluateInterpolatedProperty(property, new MapEnv({ $zoom: zoom }));
}

describe("Interpolation", function() {
    it("Discrete", () => {
        const numberProperty = createInterpolatedPropertyInt({
            ...numberPropertyDef,
            interpolationMode: InterpolationMode.Discrete
        });
        const booleanProperty = createInterpolatedPropertyInt({
            ...booleanPropertyDef,
            interpolationMode: InterpolationMode.Discrete
        });
        const colorProperty = createInterpolatedPropertyInt({
            ...colorPropertyDef,
            interpolationMode: InterpolationMode.Discrete
        });
        const enumProperty = createInterpolatedPropertyInt({
            ...enumPropertyDef,
            interpolationMode: InterpolationMode.Discrete
        });
        assert.strictEqual(getInterpolated(numberProperty, -Infinity), 0);
        assert.strictEqual(getInterpolated(numberProperty, 0), 0);
        assert.strictEqual(getInterpolated(numberProperty, 2.5), 0);
        assert.strictEqual(getInterpolated(numberProperty, 5), 100);
        assert.strictEqual(getInterpolated(numberProperty, 7.5), 100);
        assert.strictEqual(getInterpolated(numberProperty, 10), 500);
        assert.strictEqual(getInterpolated(numberProperty, Infinity), 500);

        assert.strictEqual(getInterpolated(booleanProperty, -Infinity), true);
        assert.strictEqual(getInterpolated(booleanProperty, 0), true);
        assert.strictEqual(getInterpolated(booleanProperty, 2.5), true);
        assert.strictEqual(getInterpolated(booleanProperty, 5), false);
        assert.strictEqual(getInterpolated(booleanProperty, 7.5), false);
        assert.strictEqual(getInterpolated(booleanProperty, 10), true);
        assert.strictEqual(getInterpolated(booleanProperty, Infinity), true);

        assert.strictEqual(getInterpolated(colorProperty, -Infinity), 0xff0000);
        assert.strictEqual(getInterpolated(colorProperty, 0), 0xff0000);
        assert.strictEqual(getInterpolated(colorProperty, 2.5), 0xff0000);
        assert.strictEqual(getInterpolated(colorProperty, 5), 0x00ff00);
        assert.strictEqual(getInterpolated(colorProperty, 7.5), 0x00ff00);
        assert.strictEqual(getInterpolated(colorProperty, 10), 0x0000ff);
        assert.strictEqual(getInterpolated(colorProperty, Infinity), 0x0000ff);

        assert.strictEqual(getInterpolated(enumProperty, -Infinity), "Enum0");
        assert.strictEqual(getInterpolated(enumProperty, 0), "Enum0");
        assert.strictEqual(getInterpolated(enumProperty, 2.5), "Enum0");
        assert.strictEqual(getInterpolated(enumProperty, 5), "Enum1");
        assert.strictEqual(getInterpolated(enumProperty, 7.5), "Enum1");
        assert.strictEqual(getInterpolated(enumProperty, 10), "Enum2");
        assert.strictEqual(getInterpolated(enumProperty, Infinity), "Enum2");
    });
    it("Linear", () => {
        const numberProperty = createInterpolatedPropertyInt({
            ...numberPropertyDef,
            interpolationMode: InterpolationMode.Linear
        });
        const colorProperty = createInterpolatedPropertyInt({
            ...colorPropertyDef,
            interpolationMode: InterpolationMode.Linear
        });

        assert.equal(getInterpolated(numberProperty, -Infinity), 0);
        assert.equal(getInterpolated(numberProperty, 0), 0);
        assert.equal(getInterpolated(numberProperty, 2.5), 50);
        assert.equal(getInterpolated(numberProperty, 5), 100);
        assert.equal(getInterpolated(numberProperty, 7.5), 300);
        assert.equal(getInterpolated(numberProperty, 10), 500);
        assert.equal(getInterpolated(numberProperty, Infinity), 500);

        assert.equal(getInterpolated(colorProperty, -Infinity), 0xff0000);
        assert.equal(getInterpolated(colorProperty, 0), 0xff0000);
        // rgb: [ 0.5, 0.5, 0 ]
        assert.equal(getInterpolated(colorProperty, 2.5), 0x7f7f00);
        assert.equal(getInterpolated(colorProperty, 5), 0x00ff00);
        // rgb: [ 0, 0.5, 0.5 ]
        assert.equal(getInterpolated(colorProperty, 7.5), 0x007f7f);
        assert.equal(getInterpolated(colorProperty, 10), 0x0000ff);
        assert.equal(getInterpolated(colorProperty, Infinity), 0x0000ff);
    });
    it("Cubic", () => {
        const numberProperty = createInterpolatedPropertyInt({
            ...numberPropertyDef,
            interpolationMode: InterpolationMode.Cubic
        });
        const colorProperty = createInterpolatedPropertyInt({
            ...colorPropertyDef,
            interpolationMode: InterpolationMode.Cubic
        });

        assert.equal(getInterpolated(numberProperty, -Infinity), 0);
        assert.equal(getInterpolated(numberProperty, 0), 0);
        assert.equal(getInterpolated(numberProperty, 2.5), 31.25);
        assert.equal(getInterpolated(numberProperty, 5), 100);
        assert.equal(getInterpolated(numberProperty, 7.5), 281.25);
        assert.equal(getInterpolated(numberProperty, 10), 500);
        assert.equal(getInterpolated(numberProperty, Infinity), 500);

        assert.equal(getInterpolated(colorProperty, -Infinity), 0xff0000);
        assert.equal(getInterpolated(colorProperty, 0), 0xff0000);
        // rgb: [ 0.4375, 0.625, 0 ]
        assert.equal(getInterpolated(colorProperty, 2.5), 0x6f9f00);
        assert.equal(getInterpolated(colorProperty, 5), 0x00ff00);
        // rgb: [ 0, 0.625, 0.4375 ]
        assert.equal(getInterpolated(colorProperty, 7.5), 0x009f6f);
        assert.equal(getInterpolated(colorProperty, 10), 0x0000ff);
        assert.equal(getInterpolated(colorProperty, Infinity), 0x0000ff);
    });
    it("Exponential", () => {
        const numberProperty = createInterpolatedPropertyInt({
            ...numberPropertyDef,
            interpolationMode: InterpolationMode.Exponential
        });
        const colorProperty = createInterpolatedPropertyInt({
            ...colorPropertyDef,
            interpolationMode: InterpolationMode.Exponential
        });

        assert.equal(getInterpolated(numberProperty, -Infinity), 0);
        assert.equal(getInterpolated(numberProperty, 0), 0);
        assert.equal(getInterpolated(numberProperty, 2.5), 25);
        assert.equal(getInterpolated(numberProperty, 5), 100);
        assert.equal(getInterpolated(numberProperty, 7.5), 200);
        assert.equal(getInterpolated(numberProperty, 10), 500);
        assert.equal(getInterpolated(numberProperty, Infinity), 500);

        assert.equal(getInterpolated(colorProperty, -Infinity), 0xff0000);
        assert.equal(getInterpolated(colorProperty, 0), 0xff0000);
        // rgb: [ 0.75, 0.25, 0 ]
        assert.equal(getInterpolated(colorProperty, 2.5), 0xbf3f00);
        assert.equal(getInterpolated(colorProperty, 5), 0x00ff00);
        // rgb: [ 0, 0.75, 0.25 ]
        assert.equal(getInterpolated(colorProperty, 7.5), 0x00bf3f);
        assert.equal(getInterpolated(colorProperty, 10), 0x0000ff);
        assert.equal(getInterpolated(colorProperty, Infinity), 0x0000ff);
    });
});
