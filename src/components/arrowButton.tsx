import React from 'react';
import SvgIcon, { Svg } from './svgIcon';

const buttonSize = 20;

export type Arrow = Svg.ArrowLeft | Svg.ArrowRight | Svg.ArrowBeginning | Svg.ArrowEnding;

interface Props {
  arrow: Arrow;
  onClick?: () => void;
  disabled?: boolean;
}

const ArrowButton = ({ arrow, onClick, disabled }: Props) => {

  return (
    <button onClick={onClick} disabled={disabled}>
      <SvgIcon svg={arrow} width={buttonSize} height={buttonSize} />
    </button>
  );
};

export default ArrowButton;
