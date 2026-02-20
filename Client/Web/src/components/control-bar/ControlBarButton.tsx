import React from 'react';

interface ControlBarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  isDisabled?: boolean;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  badge?: number;
  className?: string;
  tooltip?: string;
  compact?: boolean;
}

/**
 * 컨트롤 바 버튼 컴포넌트
 * Zoom 스타일의 하단 컨트롤 바 버튼
 *
 * - 기본 모드: 60x52, 아이콘 + 라벨
 * - 컴팩트 모드: 32x32, 아이콘 + 배지만
 */
export const ControlBarButton: React.FC<ControlBarButtonProps> = ({
  icon,
  label,
  onClick,
  isActive = false,
  isDisabled = false,
  variant = 'default',
  badge,
  className = '',
  tooltip,
  compact = false,
}) => {
  const baseClasses = compact
    ? `
      relative flex items-center justify-center
      w-8 h-8 rounded-lg overflow-hidden
      transition-all duration-200 ease-in-out
      focus:outline-none focus:ring-2 focus:ring-white/30
    `
    : `
      relative flex flex-col items-center justify-center
      w-[60px] h-[52px] rounded-lg overflow-hidden
      transition-all duration-200 ease-in-out
      focus:outline-none focus:ring-2 focus:ring-white/30
    `;

  const variantClasses = {
    default: isActive
      ? 'bg-white/20 text-white'
      : 'text-white/80 hover:bg-white/10 hover:text-white',
    danger: 'text-red-400 hover:bg-red-500/20 hover:text-red-300',
    success: isActive
      ? 'bg-green-500/30 text-green-400'
      : 'text-white/80 hover:bg-green-500/20 hover:text-green-400',
    warning: isActive
      ? 'bg-yellow-500/30 text-yellow-400'
      : 'text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300',
  };

  const disabledClasses = isDisabled
    ? 'opacity-50 cursor-not-allowed'
    : 'cursor-pointer';

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} ${className}`}
      title={tooltip || label}
      disabled={isDisabled}
    >
      {/* 아이콘 */}
      <div className="relative">
        <div className={compact ? "w-5 h-5 flex items-center justify-center" : "w-6 h-6 flex items-center justify-center"}>
          {icon}
        </div>
        {/* 배지 */}
        {badge !== undefined && badge > 0 && (
          <span className={`absolute ${compact ? '-top-1 -right-1.5 min-w-[14px] h-[14px] text-[9px]' : '-top-1 -right-1 min-w-[18px] h-[18px] text-xs'} px-0.5 bg-red-500 text-white font-bold rounded-full flex items-center justify-center`}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      {/* 라벨 (컴팩트 모드에서는 숨김) */}
      {!compact && (
        <span className="mt-0.5 text-[10px] font-medium whitespace-nowrap">
          {label}
        </span>
      )}
    </button>
  );
};

export default ControlBarButton;
