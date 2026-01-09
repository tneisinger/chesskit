import React from 'react';
import Link from "next/link";
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
  href?: string;
}

const Button = ({
  buttonStyle = ButtonStyle.Primary,
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
    'bg-btn-primary',
    'hover:bg-btn-primary-hover',
    'no-underline',
    'whitespace-nowrap',
  ];

  switch (buttonStyle) {
    case ButtonStyle.Primary:
      classes.push('bg-color-btn-primary', 'hover:bg-color-btn-primary-hover');
      break;
    case ButtonStyle.Secondary:
      classes.push('bg-color-btn-secondary', 'hover:bg-color-btn-secondary-hover');
      break;
    case ButtonStyle.Danger:
      classes.push('!bg-[#c82333]', 'hover:!bg-[#b21f2e]');
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
