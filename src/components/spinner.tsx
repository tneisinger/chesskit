// The width and height of the spinner in pixels when scale === 1;
const naturalSizePx = 80;

// Use these to center the origin point at the center of the spinner
const centeredOriginX = 37.5;
const centeredOriginY = 3;

interface Props {
  scale?: number;
  tailwindColor?: string;
}

const Spinner = ({ scale = 1, tailwindColor = 'bg-black' }: Props) => {
  const classes = ['inline-block relative w-20 h-20'];

  const size = { width: naturalSizePx, height: naturalSizePx };
  size.width = scale * size.width;
  size.height = scale * size.height;

  const childDivClass = `absolute w-[6px] h-[18px] rounded-[20%] origin-[40px_40px] animate-[ldsSpinner_1.2s_linear_infinite]
    after:content-[''] after:block after:absolute after:top-[3px] after:left-[37px] after:w-[6px] after:h-[18px] after:rounded-[20%]
    after:${tailwindColor}`;


  return (
    <div style={{ ...size }}>
      <div
        style={{ transform: `scale(${scale})`}}
        className={classes.join(' ')}
      >
        <div className={`${childDivClass} rotate-0 [animation-delay:-1.1s]`} />
        <div className={`${childDivClass} rotate-[30deg] [animation-delay:-1s]`} />
        <div className={`${childDivClass} rotate-[60deg] [animation-delay:-0.9s]`} />
        <div className={`${childDivClass} rotate-[90deg] [animation-delay:-0.8s]`} />
        <div className={`${childDivClass} rotate-[120deg] [animation-delay:-0.7s]`} />
        <div className={`${childDivClass} rotate-[150deg] [animation-delay:-0.6s]`} />
        <div className={`${childDivClass} rotate-[180deg] [animation-delay:-0.5s]`} />
        <div className={`${childDivClass} rotate-[210deg] [animation-delay:-0.4s]`} />
        <div className={`${childDivClass} rotate-[240deg] [animation-delay:-0.3s]`} />
        <div className={`${childDivClass} rotate-[270deg] [animation-delay:-0.2s]`} />
        <div className={`${childDivClass} rotate-[300deg] [animation-delay:-0.1s]`} />
        <div className={`${childDivClass} rotate-[330deg] [animation-delay:0s]`} />
      </div>
      <style jsx>{`
        @keyframes ldsSpinner {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default Spinner;
