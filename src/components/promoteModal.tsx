import React from 'react';
import Modal from '@/components/modal';

interface Props {
  show: boolean;
  color: 'w' | 'b';
  handleClick: (piece: 'q' | 'r' | 'b' | 'n') => void;
  pieceSize: number;
}

const spritesUrl = '../assets/images/chessboard-sprite-staunty.svg';

const PromoteModal = ({ show, color, pieceSize, ...props }: Props) => {

  const makePieceHtml = (piece: 'q' | 'r' | 'b' | 'n') => (
    <div
      onClick={() => props.handleClick(piece)}
      className="w-[50px] h-[50px] rounded mr-1 last:mr-0 inline-block cursor-pointer hover:bg-gray-300"
      style={{ height: pieceSize, width: pieceSize }}
    >
      <svg href={spritesUrl} viewBox='0 0 40 40'><use href={`#${color}${piece}`} /></svg>
    </div>
  )

  return (
    <Modal show={show}>
      <div className="bg-white dark:bg-gray-800 rounded p-2 opacity-92">
        <h3
          className="m-0 p-0 mb-1 text-center"
          style={{ fontSize: `${pieceSize * 0.03}rem` }}
        >
          Promote
        </h3>
        {makePieceHtml('q')}
        {makePieceHtml('r')}
        {makePieceHtml('b')}
        {makePieceHtml('n')}
      </div>
    </Modal>
  );
};

export default PromoteModal;
