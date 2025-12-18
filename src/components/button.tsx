import React from 'react';
// import PropTypes from 'prop-types';
import { assertUnreachable } from '../utils';

export enum ButtonStyle {
  Primary,
  Secondary,
  Danger,
}

export enum ButtonSize {
  Normal,
  Small,
}

export interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  buttonStyle?: ButtonStyle;
  buttonSize?: ButtonSize;
}

const Button = ({
  buttonStyle = ButtonStyle.Primary,
  buttonSize = ButtonSize.Normal,
  ...props
}: Props) => {
  const classes = [
    'text-[#ccc]',
    'hover:text-[#ddd]',
    'cursor-pointer',
    'px-2',
    'py-1',
    'my-2',
    'rounded',
    'bg-foreground/10',
    'hover:bg-foreground/20',
    'no-underline',
  ];

  switch (buttonStyle) {
    case ButtonStyle.Primary:
      classes.push('bg-color-btn-primary', 'hover:bg-color-btn-primary-hover');
      break;
    case ButtonStyle.Secondary:
      classes.push('bg-color-btn-secondary', 'hover:bg-color-btn-secondary-hover');
      break;
    case ButtonStyle.Danger:
      classes.push('bg-color-btn-danger', 'hover:bg-color-btn-danger-hover');
      break;
    default:
      assertUnreachable(buttonStyle);
  }

  switch (buttonSize) {
    case ButtonSize.Normal:
      // Normal size uses default padding
      break;
    case ButtonSize.Small:
      classes.push('text-sm');
      break;
    default:
      assertUnreachable(buttonSize);
  }

  if (props.disabled) {
    classes.push(
      '!cursor-default',
      '!text-[#ddd]',
      '!bg-color-btn-disabled',
      'hover:!bg-color-btn-disabled'
    );
  }

  return (
    <button {...props} className={classes.join(' ')} />
  );
};

export default Button;
