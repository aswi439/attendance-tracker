import React from 'react';

export interface RealismButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

const RealismButton: React.FC<RealismButtonProps> = ({
  text,
  children,
  className = '',
  onClick,
  disabled,
  ...props
}) => {
  const content = text || children;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative p-[2px] rounded-[16px] text-[1.4rem] border-none cursor-pointer bg-[radial-gradient(circle_80px_at_80%_-10%,_#ffffff,_#181b1b)] transition-all ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      {...props}
    >
      {/* Glow behind button */}
      <div className="absolute top-0 right-0 w-[65%] h-[60%] rounded-[120px] shadow-[0_0_20px_#ffffff38] group-hover:shadow-[0_0_40px_#ffffff60] transition-all duration-300 ease-out -z-10" />

      {/* Bottom-left accent blob */}
      <div
        className="absolute bottom-0 left-0 w-[50px] h-[50%] rounded-[17px] transition-all duration-300 ease-out 
        bg-[radial-gradient(circle_60px_at_0%_100%,_#38BDF8,_#0050C850,_transparent)] 
        shadow-[-2px_9px_40px_#0080FF40] 
        group-hover:w-[90px] group-hover:shadow-[-4px_1px_45px_#0080FF60]"
      />

      {/* Inner content */}
      <div className="relative px-[25px] py-[14px] group-hover:scale-105 rounded-[14px] text-white bg-[radial-gradient(circle_80px_at_80%_-50%,_#777777,_#0f1111)] z-10 transition-all duration-300 font-semibold flex items-center justify-center gap-2">
        {content}

        {/* Inner glow layer */}
        <div className="absolute inset-0 rounded-[14px] bg-[radial-gradient(circle_60px_at_0%_100%,_#00e1ff1a,_#0000ff11,_transparent)] z-[-1]" />
      </div>
    </button>
  );
};

export { RealismButton };
export default RealismButton;
