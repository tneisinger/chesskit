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
    <button
      className="bg-transparent border-none disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={onClick}
      disabled={disabled}
    >
      <div className="invert brightness-90 hover:brightness-100 hover:cursor-pointer brightness-110 hover:brightness-125 transition-all">
        <SvgIcon svg={arrow} width={buttonSize} height={buttonSize} />
      </div>
    </button>
  );
};

export default ArrowButton;
