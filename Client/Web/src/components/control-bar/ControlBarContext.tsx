import { createContext, useContext } from 'react';

interface ControlBarContextType {
  compact: boolean;
  showAllButtons: boolean; // false일 때 필수 버튼만 표시
}

export const ControlBarContext = createContext<ControlBarContextType>({
  compact: false,
  showAllButtons: true,
});

export const useControlBarContext = () => useContext(ControlBarContext);
