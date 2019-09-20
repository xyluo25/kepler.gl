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

import React, {Component} from 'react';
import PropTypes from 'prop-types';
import uniq from 'lodash.uniq';
import styled from 'styled-components';
import {createSelector} from 'reselect';

import ItemSelector from 'components/common/item-selector/item-selector';
import {PanelLabel} from 'components/common/styled-components';
import RangeSlider from 'components/common/range-slider';
import Switch from 'components/common/switch';
import ColorPalette from './color-palette';
import CustomPalette from './custom-palette';
import {COLOR_RANGES} from 'constants/color-ranges';
import {numberSort} from 'utils/data-utils';
import {reverseColorRange} from 'utils/color-utils';

const ALL_TYPES = uniq(
  COLOR_RANGES.map(c => c.type)
    .filter(ctype => ctype)
    .concat(['all', 'custom'])
);

const ALL_STEPS = uniq(COLOR_RANGES.map(d => d.colors.length)).sort(numberSort);

const StyledColorConfig = styled.div`
  padding: 12px 12px 0 12px;
`;

const ColorRangeSelector = styled.div`
  padding-bottom: 12px;
`;

const StyledPaletteConfig = styled.div`
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  .color-palette__config__label {
    flex-grow: 1;
  }
  .color-palette__config__select {
    flex-grow: 1;
  }
  .item-selector .item-selector__dropdown {
    ${props => props.theme.secondaryInput};
  }
`;

const CONFIG_SETTINGS = {
  type: {
    type: 'select',
    options: ALL_TYPES
  },
  steps: {
    type: 'select',
    options: ALL_STEPS
  },
  reversed: {
    type: 'switch',
    options: [true, false]
  },
  custom: {
    label: 'Custom Palette',
    type: 'switch',
    options: [true, false]
  }
};

export default class ColorRangeSelect extends Component {
  static propTypes = {
    colorPaletteUI: PropTypes.object.isRequired,
    selectedColorRange: PropTypes.object.isRequired,
    onSelectColorRange: PropTypes.func.isRequired,
    setColorPaletteUI: PropTypes.func.isRequired,
    // optional
    colorRanges: PropTypes.arrayOf(PropTypes.any)
  };

  static defaultProps = {
    colorRanges: COLOR_RANGES,
    onSelectColorRange: () => {},
    setColorPaletteUI: () => {}
  };

  colorRangesSelector = props => props.colorRanges;
  configTypeSelector = props => props.colorPaletteUI.colorRangeConfig.type;
  configStepSelector = props => props.colorPaletteUI.colorRangeConfig.steps;
  filteredColorRange = createSelector(
    this.colorRangesSelector,
    this.configTypeSelector,
    this.configStepSelector,
    (colorRanges, type, steps) => {
      return colorRanges.filter(colorRange => {
        const isType = type === 'all' || type === colorRange.type;
        const isStep = Number(steps) === colorRange.colors.length;

        return isType && isStep;
      });
    }
  );

  _updateConfig = ({key, value}) => {
    if (key === 'custom' && value === true) {
      // change default custom palette to selected color range
      this._onEnableCustomPalette();
    }
    this._setColorRangeConfig({[key]: value});
  };

  _onSetCustomPalette = config => {
    this.props.setColorPaletteUI({
      customPalette: {
        ...this.props.colorPaletteUI.customPalette,
        ...config
      }
    });
  };

  _setColorRangeConfig = newConfig => {
    this.props.setColorPaletteUI({
      colorRangeConfig: {
        ...this.props.colorPaletteUI.colorRangeConfig,
        ...newConfig
      }
    });
  };

  _onEnableCustomPalette = () => {
    const {colors, name} = this.props.selectedColorRange;
    this._onSetCustomPalette({
      name: ['Custom Palette', name].join(' '),
      colors: [...colors]
    });
  };

  _CustomPaletteCancel = newConfig => {
    this._setColorRangeConfig({custom: false});
  };

  _onToggleSketcher = val => {
    this.props.setColorPaletteUI({
      showSketcher: val
    });
  };

  render() {
    const {
      customPalette,
      showSketcher,
      colorRangeConfig
    } = this.props.colorPaletteUI;

    const filteredColorRanges = this.filteredColorRange(this.props);

    return (
      <ColorRangeSelector className="color-range-selector">
        <StyledColorConfig>
          {(colorRangeConfig.custom
            ? ['custom']
            : Object.keys(colorRangeConfig)
          ).map(key => (
            <PaletteConfig
              key={key}
              label={CONFIG_SETTINGS[key].label || key}
              config={CONFIG_SETTINGS[key]}
              value={colorRangeConfig[key]}
              onChange={value => this._updateConfig({key, value})}
            />
          ))}
        </StyledColorConfig>

        {colorRangeConfig.custom ? (
          <CustomPalette
            customPalette={customPalette}
            showSketcher={showSketcher}
            selected={this.props.selectedColorRange}
            onApply={this.props.onSelectColorRange}
            onToggleSketcher={this._onToggleSketcher}
            setCustomPalette={this._onSetCustomPalette}
            onCancel={this._CustomPaletteCancel}
          />
        ) : (
          <ColorPaletteGroup
            colorRanges={filteredColorRanges}
            onSelect={this.props.onSelectColorRange}
            selected={this.props.selectedColorRange}
            reversed={colorRangeConfig.reversed}
          />
        )}
      </ColorRangeSelector>
    );
  }
}

const PaletteConfig = ({
  category,
  label,
  value,
  config: {type, options},
  onChange
}) => (
  <StyledPaletteConfig
    className="color-palette__config"
    onClick={e => e.stopPropagation()}
  >
    <div className="color-palette__config__label">
      <PanelLabel>{label}</PanelLabel>
    </div>
    {type === 'select' && (
      <div className="color-palette__config__select">
        <ItemSelector
          selectedItems={value}
          options={options}
          multiSelect={false}
          searchable={false}
          onChange={onChange}
        />
      </div>
    )}
    {type === 'slider' && (
      <div className="color-palette__config__slider">
        <div className="color-palette__config__slider__slider">
          <RangeSlider
            range={options}
            value0={options[0]}
            value1={value}
            step={1}
            isRanged={false}
            showInput={false}
            onChange={val => onChange(val[1])}
          />
        </div>
        <div className="color-palette__config__slider__number">{value}</div>
      </div>
    )}
    {type === 'switch' && (
      <Switch
        checked={value}
        id={`${category}-${label}-toggle`}
        onChange={() => onChange(!value)}
        secondary
      />
    )}
  </StyledPaletteConfig>
);

const StyledColorRange = styled.div`
  padding: 0 8px;
  :hover {
    background-color: ${props => props.theme.panelBackgroundHover};
    cursor: pointer;
  }
`;

const ColorPaletteGroup = ({reversed, onSelect, selected, colorRanges}) => (
  <div className="color-palette__group">
    {colorRanges.map((colorRange, i) => (
      <StyledColorRange
        className="color-palette-outer"
        key={`${colorRange.name}-${i}`}
        onClick={e =>
          onSelect(
            reversed ? reverseColorRange(colorRange) : colorRange,
            e
          )
        }
      >
        <ColorPalette
          colors={colorRange.colors}
          isReversed={reversed}
          isSelected={
            colorRange.name === selected.name &&
            reversed === Boolean(selected.reversed)
          }
        />
      </StyledColorRange>
    ))}
  </div>
);
