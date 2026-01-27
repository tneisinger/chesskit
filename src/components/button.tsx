import React from 'react';
import Link from "next/link";
import { assertUnreachable } from '../utils';

export enum ButtonStyle {
  Primary,
  Secondary,
  Danger,
  Normal,
}

export enum ButtonSize {
  Normal,
  Small,
}

export interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  buttonStyle?: ButtonStyle;
  buttonSize?: ButtonSize;
  href?: string;
}

const Button = ({
  buttonStyle = ButtonStyle.Normal,
  buttonSize = ButtonSize.Normal,
  href,
  ...props
}: Props) => {
  const classes = [
    'text-[#ddd]',
    'hover:text-[#eee]',
    'cursor-pointer',
    'px-2',
    href ? 'py-1.5' : 'py-1',
    'rounded',
    'no-underline',
    'whitespace-nowrap',
  ];

  const colors = [];

  switch (buttonStyle) {
    case ButtonStyle.Primary:
      colors.push('bg-btn-primary', 'hover:bg-btn-primary-hover');
      break;
    case ButtonStyle.Secondary:
      colors.push('bg-btn-secondary', 'hover:bg-btn-secondary-hover');
      break;
    case ButtonStyle.Danger:
      colors.push('!bg-[#c82333]', 'hover:!bg-[#b21f2e]');
      break;
    case ButtonStyle.Normal:
      colors.push('bg-btn-normal', 'hover:bg-btn-normal-hover');
      break;
    default:
      assertUnreachable(buttonStyle);
  }

  classes.push(...colors);

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
      '!text-[#777]',
      '!bg-foreground/10',
      'hover:!bg-foreground/10',
    );
  }

  if (href) return (
    <Link
      href={href}
      className={classes.join(' ')}
    >
      {props.children}
    </Link>
  );

  return (
    <button {...props} className={classes.join(' ')} />
  );
};

export default Button;
