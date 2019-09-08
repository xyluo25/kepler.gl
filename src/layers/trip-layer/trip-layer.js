// Copyright (c) 2019 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import memoize from 'lodash.memoize';
import uniq from 'lodash.uniq';
import Layer from '../base-layer';
import {TripsLayer as DeckGLTripsLayer} from 'deck.gl';

import {GEOJSON_FIELDS} from 'constants/default-settings';
import TripLayerIcon from './trip-layer-icon';

import {
  getGeojsonDataMaps,
  getGeojsonBounds,
  getGeojsonFeatureTypes,
  isTripGeoJson,
  dataToTimeStamp
} from '../geojson-layer/geojson-utils';
import {hexToRgb} from 'utils/color-utils';
import TripInfoModalFactory from './trip-info-modal';

export const tripVisConfigs = {
  opacity: 'opacity',
  // thickness: {
  //   type: 'number',
  //   defaultValue: 0.5,
  //   label: 'Stroke Width',
  //   isRanged: false,
  //   range: [0, 100],
  //   step: 0.1,
  //   group: 'stroke',
  //   property: 'thickness'
  // },
  thickness: 'thickness',

  colorRange: 'colorRange',
  trailLength: 'trailLength',

  sizeRange: 'strokeWidthRange',
  stroked: 'stroked',
  filled: 'filled',
  wireframe: 'wireframe'
};

export const geoJsonRequiredColumns = ['geojson'];
export const featureAccessor = ({geojson}) => d => d[geojson.fieldIdx];
export const featureResolver = ({geojson}) => geojson.fieldIdx;

export default class TripLayer extends Layer {
  constructor(props) {
    super(props);

    this.dataToFeature = {};
    this.registerVisConfig(tripVisConfigs);
    this.getFeature = memoize(featureAccessor, featureResolver);
    this._layerInfoModal = TripInfoModalFactory();
  }

  get type() {
    return 'trip';
  }

  get name() {
    return 'Trip';
  }

  get layerIcon() {
    return TripLayerIcon;
  }

  get requiredLayerColumns() {
    return geoJsonRequiredColumns;
  }

  get visualChannels() {
    return {
      ...super.visualChannels,

      size: {
        ...super.visualChannels.size,
        property: 'stroke',
        condition: config => config.visConfig.stroked
      }
    };
  }

  getPositionAccessor() {
    return this.getFeature(this.config.columns);
  }

  get layerInfoModal() {
    return {
      id: 'iconInfo',
      template: this._layerInfoModal,
      modalProps: {
        title: 'How to enable trip animation'
      }
    };
  }

  static findDefaultLayerProps({label, fields, data}, foundLayers) {

    const geojsonColumns = fields.filter(f => f.type === 'geojson').map(f => f.name);

    const defaultColumns = {
      geojson: uniq([...GEOJSON_FIELDS.geojson, ...geojsonColumns])
    };

    const geojsonField = fields.findIndex(f => f.type === 'geojson');

    let isTrip = false;
    if (geojsonField > -1) {
      const features = data.map(d => d[geojsonField]);
      isTrip = isTripGeoJson(features)
    }

    const foundColumns = this.findDefaultColumnField(defaultColumns, fields);

    if (!foundColumns || !foundColumns.length || !isTrip
    ) {
      return [];
    }

    return {
      props: foundColumns.map(columns => ({
        label:
          (typeof label === 'string' && label.replace(/\.[^/.]+$/, '')) || this.type,
        columns,
        isVisible: true
      })),
      foundLayers: foundLayers.filter(l => l.type !== 'geojson')
    };
  }

  getDefaultLayerConfig(props) {
    return {
      ...super.getDefaultLayerConfig(props),
      animation: {
        enabled: true,
        domain: [0, 1000]
      }
    };
  }

  getHoverData(object, allData) {
    // index of allData is saved to feature.properties
    return allData[object.properties.index];
  }

  // TODO: fix complexity
  /* eslint-disable complexity */
  formatLayerData(_, allData, filteredIndex, oldLayerData, opt = {}) {
    // to-do: parse segment from allData
    const {
      colorScale,
      colorField,
      colorDomain,
      color,
      sizeScale,
      sizeDomain,
      sizeField,
      visConfig
    } = this.config;

    const {stroked, colorRange, sizeRange} = visConfig;

    const getFeature = this.getPositionAccessor(this.config.column);

    // geojson feature are object, if doesn't exists
    // create it and save to layer
    if (!oldLayerData || oldLayerData.getFeature !== getFeature) {
      this.updateLayerMeta(allData, getFeature);
    }

    let geojsonData;

    if (
      oldLayerData &&
      oldLayerData.data &&
      opt.sameData &&
      oldLayerData.getFeature === getFeature
    ) {
      // no need to create a new array of data
      // use updateTriggers to selectively re-calculate attributes
      geojsonData = oldLayerData.data;
    } else {
      // filteredIndex is a reference of index in allData which can map to feature
      geojsonData = filteredIndex.map(i => this.dataToFeature[i]).filter(d => d);
    }

    // color
    const cScale =
      colorField &&
      this.getVisChannelScale(
        colorScale,
        colorDomain,
        colorRange.colors.map(hexToRgb)
      );

    // calculate stroke scale - if stroked = true
    const sScale =
      sizeField &&
      stroked &&
      this.getVisChannelScale(sizeScale, sizeDomain, sizeRange);

    return {
      data: geojsonData,
      getPath: d => d.geometry.coordinates,
      getTimestamps: d => this.dataToTimeStamp[d.properties.index],
      getColor: d =>
        cScale
          ? this.getEncodedChannelValue(
              cScale,
              allData[d.properties.index],
              colorField
            )
          : d.properties.fillColor || color,
      getWidth: d =>
        sScale
          ? this.getEncodedChannelValue(
              sScale,
              allData[d.properties.index],
              sizeField,
              0
            )
          : d.properties.lineWidth || 1
    };
  }
  /* eslint-enable complexity */

  updateLayerMeta(allData) {
    console.log('updateLayerMeta')
    const getFeature = this.getPositionAccessor();
    // console.time('dataToFeature')
    this.dataToFeature = getGeojsonDataMaps(allData, getFeature);
    // console.timeEnd('dataToFeature')
    // calculate layer meta
    // console.time('dataToTimeStamp')

    const allFeatures = Object.values(this.dataToFeature);

    this.dataToTimeStamp = dataToTimeStamp(allFeatures);
    // console.timeEnd('dataToTimeStamp')

    // console.time('getGeojsonBounds')

    // get bounds from features
    const bounds = getGeojsonBounds(allFeatures);
    // console.timeEnd('getGeojsonBounds')

    // console.time('getGeojsonFeatureTypes')

    // keep a record of what type of geometry the collection has
    const featureTypes = getGeojsonFeatureTypes(allFeatures);
    // console.timeEnd('getGeojsonFeatureTypes')

    this.updateMeta({bounds, featureTypes});
  }

  setInitialLayerConfig(allData) {
    this.updateLayerMeta(allData);
    return this;
  }

  renderLayer({data, idx, mapState, animationConfig}) {
    const {visConfig} = this.config;
    const zoomFactor = this.getZoomFactor(mapState);

    const updateTriggers = {
      getColor: {
        color: this.config.color,
        colorField: this.config.colorField,
        colorRange: visConfig.colorRange,
        colorScale: this.config.colorScale
      },
      getWidth: {
        sizeField: this.config.sizeField,
        sizeRange: visConfig.sizeRange
      },
      getTimestamps: {
        columns: this.config.columns,
        domain0: animationConfig.domain[0]
      }
    };

    return [
      new DeckGLTripsLayer({
        id: this.id,
        idx,
        data: data.data,
        getPath: data.getPath,
        getColor: data.getColor,
        getTimestamps: d => data.getTimestamps(d).map(ts => ts - animationConfig.domain[0]),
        opacity: this.config.visConfig.opacity,
        widthScale: this.config.visConfig.thickness * zoomFactor * 8,
        highlightColor:  this.config.highlightColor,

        getWidth: data.getWidth,
        rounded: true,
        pickable: true,
        autoHighlight: true,
        parameters: {depthTest: mapState.dragRotate},

        trailLength: visConfig.trailLength,
        currentTime: animationConfig.currentTime - animationConfig.domain[0],
        updateTriggers
      })
    ];
  }
}
