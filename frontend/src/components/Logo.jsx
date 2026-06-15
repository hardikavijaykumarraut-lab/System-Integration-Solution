import React from 'react';

const Logo = ({ size = 'medium', className = '' }) => {
  const sizes = {
    small: { width: 36, height: 36, fontSize: 'text-sm' },
    medium: { width: 52, height: 52, fontSize: 'text-lg' },
    large: { width: 70, height: 70, fontSize: 'text-2xl' },
  };

  const { width, height, fontSize } = sizes[size] || sizes.medium;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo Icon */}
      <div 
        className="relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-fuchsia-500 to-purple-600 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
        style={{ width, height }}
      >
        <div className="absolute inset-0 bg-white/20 rounded-2xl blur-md"></div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-3/5 h-3/5 text-white relative z-10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      
      {/* Logo Text */}
      <div className="flex flex-col">
        <span className={`font-extrabold bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent leading-tight ${fontSize}`}>
          SysInteg
        </span>
        <span className="text-xs text-gray-500 tracking-[0.2em] font-semibold uppercase">
          Solutions
        </span>
      </div>
    </div>
  );
};

export default Logo;
