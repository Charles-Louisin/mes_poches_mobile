import Svg, { Path, Rect } from 'react-native-svg';

export function CsvIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="CSV">
      <Rect x="3" y="2" width="18" height="20" rx="2" fill="#0F9D58" />
      <Path d="M7 8h10M7 12h10M7 16h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function PdfIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="PDF">
      <Path d="M6 2h9l5 5v15a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" fill="#E5252A" />
      <Path d="M15 2v5h5" fill="#B71C1C" />
      <Rect x="6.5" y="12.5" width="11" height="6.5" rx="1" fill="#fff" />
      <Path d="M8 15.2h2.2M8 17.2h3.4" stroke="#E5252A" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  );
}

export function ExcelIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Excel">
      <Rect x="3" y="2" width="18" height="20" rx="2" fill="#217346" />
      <Path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
