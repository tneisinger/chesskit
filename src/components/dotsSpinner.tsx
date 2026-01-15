const DotsSpinner = () => {
  return (
    <div className="w-10 flex items-center justify-center gap-[5px]">
      <div className="w-2.5 h-2.5 rounded-full bg-[#37342f] animate-[dotFlashing_0.4s_infinite_linear_alternate_0s]" />
      <div className="w-2.5 h-2.5 rounded-full bg-[#37342f] animate-[dotFlashing_0.4s_infinite_linear_alternate_0.2s]" />
      <div className="w-2.5 h-2.5 rounded-full bg-[#37342f] animate-[dotFlashing_0.4s_infinite_linear_alternate_0.4s]" />
    </div>
  );
};

export default DotsSpinner;
