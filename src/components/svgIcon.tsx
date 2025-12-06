import React from 'react';

const spriteFile = '/assets/sprites.svg';

/*
 * Each string value is the id of the associated svg icon
 */
export enum Svg {
  ArrowLeft = 'si-ant-caret-left',
  ArrowRight = 'si-ant-caret-right',
  ArrowBeginning = 'si-ant-step-backward',
  ArrowEnding = 'si-ant-step-forward',
  GearIcon = 'si-flat-gear',
  Check = 'si-flat-check',
  Hamburger = 'si-bootstrap-menu-hamburger',
  Trashcan = 'si-flat-trash',
  Cog = 'si-awesome-cog',
  Lightbulb = 'si-foundation-lightbulb',
  Wrench = 'si-awesome-wrench',
  Puzzle = 'si-foundation-puzzle',
  Pawn = 'si-bootstrap-pawn',
  SwoopyArrow = 'si-entypo-forward',
  Rotate = 'si-bootstrap-retweet',
  Bookmark = 'si-elusive-bookmark'
}

interface Props {
  svg: Svg;
  styles?: string;
  width?: number;
  height?: number;
}

const SvgIcon = ({ svg, styles, width, height }: Props) => {
  return (
    <svg
      className={styles}
      width={width}
      height={height}
      style={{ pointerEvents: 'none' }}
    >
      <use xlinkHref={`${spriteFile}#${svg}`} />
    </svg>
  );
};

export default SvgIcon;
