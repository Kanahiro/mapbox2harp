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
        styles.push(mbLayer2harpStyle(layer as MapboxVectorTileLayer));
    });

    const harpStyle: Theme = {
        styles: {},
    };
    harpStyle.styles![styleName] = styles;
    return harpStyle;
}

function mbLayer2harpStyle(mapboxLayer: MapboxVectorTileLayer): Style {
    const baseStyle = {
        id: mapboxLayer.id,
        layer: mapboxLayer['source-layer'],
        when: translateMapboxExpr(mapboxLayer.filter),
    };
    switch (mapboxLayer.type) {
        case 'symbol':
            return {
                ...baseStyle,
                technique: 'circles',
                color: getHarpColorBy(mapboxLayer) as string,
            };
        case 'circle':
            return {
                ...baseStyle,
                technique: 'circles',
                color: getHarpColorBy(mapboxLayer) as string,
            };
        case 'line':
            return {
                ...baseStyle,
                technique: 'solid-line',
                color: getHarpColorBy(mapboxLayer) as string,
                ...getLineStyleAttributes(mapboxLayer as mapboxgl.LineLayer),
            };
        case 'fill':
            return {
                ...baseStyle,
                technique: 'fill',
                color: getHarpColorBy(mapboxLayer) as string,
            };
        case 'fill-extrusion':
            return {
                ...baseStyle,
                technique: 'extruded-polygon',
                color: getHarpColorBy(mapboxLayer) as string,
            };
    }
}

function getHarpColorBy(
    mapboxLayer: MapboxVectorTileLayer,
): string | mapboxgl.StyleFunction | mapboxgl.Expression | undefined {
    if (mapboxLayer.paint === undefined) {
        return '#000000';
    }
    const color = (mapboxLayer.paint as any)[`${mapboxLayer.type}-color`];
    return color !== undefined ? color : '#000000';
}

function getStyleAttributesBy(mapboxLayer: MapboxVectorTileLayer) {
    switch (mapboxLayer.type) {
        case 'line':
            return {
                lineWidth: mapboxLayer.paint,
            };
    }
}

function getLineStyleAttributes(mapboxLayer: mapboxgl.LineLayer): Object {
    if (mapboxLayer.paint === undefined) {
        return {};
    }
    /*
    const lineWidth =
        mapboxLayer.paint['line-width'] !== undefined
            ? translateMapboxPaintParam(mapboxLayer.paint['line-width'])
            : 1;
    */
    return {
        lineWidth: 1,
    };
}

function translateMapboxExpr(
    mapboxExpression: object | Expression | undefined,
): Expression {
    if (mapboxExpression === undefined) {
        return [];
    }
    if (Array.isArray(mapboxExpression)) {
        return mapboxExpression.map(
            (ops: number | string | object | Expression, index) => {
                if (typeof ops === 'number') {
                    return ops;
                }
                if (typeof ops !== 'string') {
                    return translateMapboxExpr(ops);
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
                if (ops === '$type') {
                    return ['geometry-type'];
                }
                return ops;
            },
        );
    }
    return [];
}
