import {
    Theme,
    Styles,
    Style,
    StyleAttributes,
    Technique,
    Expr,
} from '@here/harp-datasource-protocol';

import { ExpressionNames } from './defnitions';
import { gsiStyle } from './fixture';

interface MapboxVectorTileLayer extends mapboxgl.Layer {
    source: string;
    'source-layer': string;
    type: 'symbol' | 'circle' | 'line' | 'fill' | 'fill-extrusion';
}

type Expression = Array<number | string | Array<any>>;

const fixture = gsiStyle as mapboxgl.Style;

console.log(JSON.stringify(mapbox2harp(fixture, 'test')));

function mapbox2harp(
    mapboxStyle: mapboxgl.Style,
    styleName: string,
): Theme | null {
    if (mapboxStyle.sources === undefined || mapboxStyle.layers === undefined) {
        return null;
    }

    const vectorTileSources = Object.keys(mapboxStyle.sources).filter(
        (sourceId) => {
            mapboxStyle.sources![sourceId].type === 'vector';
        },
    );

    let styles: Array<Style> = [];
    mapboxStyle.layers.forEach((layer) => {
        if (vectorTileSources.includes((layer as any).source)) {
            return;
        }
        const style = mbLayer2harpStyle(layer as MapboxVectorTileLayer);
        if (style !== null) {
            styles.push(style);
        }
    });

    const harpStyle: Theme = {
        styles: {},
    };
    harpStyle.styles![styleName] = styles;
    return harpStyle;
}

function mbLayer2harpStyle(mapboxLayer: MapboxVectorTileLayer): Style | null {
    const baseStyle = {
        id: mapboxLayer.id,
        layer: mapboxLayer['source-layer'],
        when: translateMapboxExpr(mapboxLayer.filter),
        color: getHarpColorBy(mapboxLayer) as string,
    };
    if (baseStyle.color === null) {
        return null;
    }
    switch (mapboxLayer.type) {
        case 'symbol':
            return {
                ...baseStyle,
                technique: 'circles',
            };
        case 'circle':
            return {
                ...baseStyle,
                technique: 'circles',
            };
        case 'line':
            return {
                ...baseStyle,
                technique: 'solid-line',
                ...getLineStyleAttributes(mapboxLayer as mapboxgl.LineLayer),
            };
        case 'fill':
            return {
                ...baseStyle,
                technique: 'fill',
            };
        case 'fill-extrusion':
            return {
                ...baseStyle,
                technique: 'extruded-polygon',
            };
    }
}

function getHarpColorBy(
    mapboxLayer: MapboxVectorTileLayer,
): string | object | Expression | null {
    if (mapboxLayer.paint === undefined) {
        return '#000000';
    }
    const color:
        | string
        | object
        | Expression
        | undefined = (mapboxLayer.paint as any)[`${mapboxLayer.type}-color`];
    if (color === undefined) {
        if ((mapboxLayer.paint as any)[`${mapboxLayer.type}-pattern`]) {
            // TODO: sprite-pattern
            return null;
        }
        return '#000000';
    } else {
        if (typeof color === 'string') {
            return color;
        } else {
            return translateMapboxExpr(color);
        }
    }
}

function getLineStyleAttributes(mapboxLayer: mapboxgl.LineLayer): Object {
    if (mapboxLayer.paint === undefined) {
        return {
            lineWidth: 1,
        };
    }
    let attributes = {};
    if (mapboxLayer.paint['line-width'] !== undefined) {
        let lineWidth: number | Expression;
        if (typeof mapboxLayer.paint['line-width'] === 'number') {
            lineWidth = mapboxLayer.paint['line-width'];
        } else {
            //style function
            //lineWidth = translateMapboxExpr(mapboxLayer.paint['line-width']);
            lineWidth = 1;
        }
        (attributes as any).lineWidth = lineWidth;
    }
    return attributes;
}

function translateMapboxExpr(
    mapboxExpression: object | Expression | undefined,
): Expression {
    if (mapboxExpression === undefined) {
        return [];
    } else if (Array.isArray(mapboxExpression)) {
        return mapboxExpression.map(
            (ops: number | string | object | Expression, index) => {
                if (typeof ops === 'number') {
                    return ops;
                }
                if (typeof ops !== 'string') {
                    return translateMapboxExpr(ops);
                }
                if (ops === '$type') {
                    return ['geometry-type'];
                }
                if (!ExpressionNames.includes(ops)) {
                    if (
                        ExpressionNames.includes(
                            String(mapboxExpression[index - 1]),
                        )
                    ) {
                        return ['get', ops];
                    } else {
                        return ops;
                    }
                }
                return ops;
            },
        );
    } else {
        // object
        // define translate style function
        return [];
    }
}
