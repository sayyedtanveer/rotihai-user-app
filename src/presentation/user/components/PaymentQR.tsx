import React, { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import QR from 'qrcode/lib/core/qrcode';
export function PaymentQR({ value }: { value: string }) {
  const matrix = useMemo(() => QR.create(value, { errorCorrectionLevel: 'M' }).modules, [value]);
  const commands: string[] = [];
  for (let y = 0; y < matrix.size; y++) for (let x = 0; x < matrix.size; x++) {
    if (matrix.data[y * matrix.size + x]) commands.push('M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z');
  }
  return <Svg accessibilityLabel="Scan this QR code in your UPI app" width={250} height={250} viewBox={'0 0 ' + (matrix.size + 8) + ' ' + (matrix.size + 8)}>
    <Rect width="100%" height="100%" fill="#fff" /><Path d={commands.join('')} fill="#111" />
  </Svg>;
}

