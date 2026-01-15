import SvgIcon, { Svg } from './svgIcon';

interface Props {
  size?: number;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

const deleteButton = ({ size, disabled, onClick, className }: Props) => {
  if (size == undefined) size = 20;

  const svgIconClasses = ['invert-82'];
  if (disabled) svgIconClasses.push('invert-44');

  const classes = ['bg-transparent', 'border-none', 'p-0'];
  if (className) classes.push(className);

  return (
    <button
      className={classes.join(' ')}
      onClick={onClick}
      title={'Delete'}
      disabled={disabled}
    >
      <SvgIcon
        svg={Svg.Trashcan}
        styles={svgIconClasses.join(' ')}
        width={size}
        height={size}
      />
    </button>
  )
}

export default deleteButton
