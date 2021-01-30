import {
    Theme,
    Styles,
    Style,
    StyleAttributes,
    Technique,
    Expr,
} from '@here/harp-datasource-protocol';

import { ExpressionNames } from './defnitions';

const PX_TO_METER_MULTIPLIER = 4;

interface MapboxVectorTileLayer extends mapboxgl.Layer {
    source: string;
    'source-layer': string;
    type: 'symbol' | 'circle' | 'line' | 'fill' | 'fill-extrusion';
}

type Expression = Array<number | string | Array<any>>;

export default function mapbox2harp(
    mapboxStyle: mapboxgl.Style,
    styleName: string,
): Theme {
    if (mapboxStyle.sources === undefined || mapboxStyle.layers === undefined)
        throw Error('empty has no source or no layer.');

    const vectorSourceIds = Object.keys(mapboxStyle.sources).filter(
        (sourceId) => mapboxStyle.sources![sourceId].type === 'vector',
    );

    const styles: Array<Style> = (mapboxStyle.layers as MapboxVectorTileLayer[])
        .filter((layer) => vectorSourceIds.includes(layer.source))
        .map((layer) => mbLayer2harpStyle(layer))
        .filter((style) => Boolean(style)) as Array<Style>;

    const harpStyle: Theme = {
        styles: {
            [styleName]: styles,
        },
    };

    return harpStyle;
}

function mbLayer2harpStyle(mapboxLayer: MapboxVectorTileLayer): Style | null {
    const baseStyle: Style = {
        id: mapboxLayer.id,
        technique: 'circles',
        layer: mapboxLayer['source-layer'],
        when: translateMapboxExpr(mapboxLayer.filter),
        color: getHarpColorBy(mapboxLayer) as string,
        opacity: getHarpOpacityBy(mapboxLayer) as number,
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
                metricUnit: 'Pixel', // deprecated
                technique: getLineTechnique(mapboxLayer as mapboxgl.LineLayer),
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

function getHarpOpacityBy(
    mapboxLayer: MapboxVectorTileLayer,
): number | object | Expression {
    if (mapboxLayer.paint === undefined) {
        return 1.0;
    }
    const opacity:
        | number
        | object
        | Expression
        | undefined = (mapboxLayer.paint as any)[`${mapboxLayer.type}-opacity`];
    if (opacity === undefined) return 1.0;
    if (typeof opacity === 'number') {
        return opacity;
    } else {
        return translateMapboxExpr(opacity);
    }
}

function getLineTechnique(
    mapboxLayer: mapboxgl.LineLayer,
): 'solid-line' | 'dashed-line' {
    if (mapboxLayer.paint?.['line-dasharray'] === undefined)
        return 'solid-line';
    return 'dashed-line';
}

function getLineStyleAttributes(mapboxLayer: mapboxgl.LineLayer): Object {
    if (mapboxLayer.paint === undefined) {
        return {
            lineWidth: 1,
        };
    }
    const attributes = {};
    if (mapboxLayer.paint['line-width'] !== undefined) {
        let lineWidth: number | Expression;
        if (typeof mapboxLayer.paint['line-width'] === 'number') {
            lineWidth = mapboxLayer.paint['line-width'];
        } else {
            //style function
            lineWidth = translateMapboxExpr(mapboxLayer.paint['line-width']);
        }
        (attributes as any).lineWidth = lineWidth;
    }
    if (mapboxLayer.paint['line-dasharray'] !== undefined) {
        (attributes as any)['dashSize'] =
            Number(mapboxLayer.paint['line-dasharray'][0]) *
            PX_TO_METER_MULTIPLIER;
        (attributes as any)['gapSize'] =
            Number(mapboxLayer.paint['line-dasharray'][1]) *
            PX_TO_METER_MULTIPLIER;
    }
    return attributes;
}

function translateMapboxExpr(
    mapboxExpression: { [key: string]: any } | Expression | undefined,
): Expression {
    if (mapboxExpression === undefined) return [];
    if (Array.isArray(mapboxExpression)) {
        return mapboxExpression.map(
            (ops: number | string | Expression, index) => {
                if (typeof ops === 'number') return ops;
                if (typeof ops !== 'string') return translateMapboxExpr(ops);
                if (ops === '$type') return ['geometry-type'];
                if (ExpressionNames.includes(ops)) return ops;
                if (
                    ExpressionNames.includes(
                        String(mapboxExpression[index - 1]),
                    )
                ) {
                    return ['get', ops];
                }
                return ops;
            },
        );
    } else {
        /**
         * when style function, like following
         * {
                base: 1.2, // can be undefined
                stops: [
                    [12, 0.5],
                    [13, 1],
                    [14, 4],
                    [20, 15],
                ],
            }
         */
        const isStyleFunctionInvalid =
            mapboxExpression['stops'] === undefined &&
            mapboxExpression['base'] === undefined;

        if (isStyleFunctionInvalid) return [];

        return [
            'interpolate',
            ['exponential', mapboxExpression['base'] || 1.0],
            ['zoom'],
            ...mapboxExpression['stops'].reduce(
                (pre: any[], current: any[]) => {
                    pre.push(...current);
                    return pre;
                },
                [],
            ),
        ];
    }
}
