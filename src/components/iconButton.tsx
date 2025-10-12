import React from 'react';
import SvgIcon, { Svg } from './svgIcon';

const iconSize = 20;

interface Props {
  icon: Svg;
  onClick: () => void;
  text?: string
  disabled?: boolean;
  isHighlighted?: boolean;
}

const IconButton = ({
  icon,
  onClick,
  text,
  disabled = false,
  isHighlighted = true
}: Props) => {

  const classes = ['bg-transparent border-none'];
  const iconClasses = ['brightness-[0.42]'];
  const textClasses = ['text-[0.65rem] text-[#777]'];

  if (isHighlighted) {
    iconClasses.push('!brightness-[0.9]');
    textClasses.push('!text-[#ddd]');
  }

  return (
    <button className={classes.join(' ')} onClick={onClick} disabled={disabled}>
      <SvgIcon svg={icon} styles={iconClasses.join(' ')} width={iconSize} height={iconSize} />
      {text && (
        <div className={textClasses.join(' ')}>
          {text}
        </div>
      )}
    </button>
  );
};

export default IconButton;
