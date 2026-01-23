import { TooltipContentProps } from 'recharts';
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

const GameChartToolTip = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-md p-2 text-black" style={{ backgroundColor: 'rgba(175, 175, 175, 0.7)' }}>
        {/* Map over the payload to display all data points */}
        {payload.map((d, index) => (
          <div key={`item-${index}`}>
            <p>
              {`${d.payload.moveNumber}${d.payload.color === 'w' ? '.' : '...'} ${d.payload.move}`}
            </p>
            {d.payload.cp !== undefined ? (
              <p>
                {`Eval: ${(d.payload.cp / 100).toFixed(2)}`}
              </p>
            ) :(
              <p>
                {d.payload.mate === 0 ? 'Checkmate' : `Mate in ${Math.abs(d.payload.mate)}`}
              </p>
            )}
            <p>
              Judgement: {d.payload.judgement}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return null;
};

export default GameChartToolTip;
