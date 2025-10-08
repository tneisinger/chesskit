import React from 'react';

/**
 * The parent of this component should be set to 'position: relative' if you want the
 * modal to be centered within its parent.
 */

interface Props {
  children: React.ReactNode;
  show: boolean;
}

const Modal = (props: Props) => {
  if (props.show) {
    return (
      <>
        <div className="absolute left-0 top-0 w-full h-full bg-black opacity-15 z-10" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">{props.children}</div>
      </>
    );
  }

  return <></>;
}

export default Modal;
