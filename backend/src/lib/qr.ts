import QRCode from 'qrcode';

/**
 * Generates a data-URL QR code encoding the booking reference.
 * The QR payload is a small JSON document so it can be scanned and
 * verified against the API.
 */
export async function generateQrDataUrl(payload: Record<string, unknown>): Promise<string> {
  return QRCode.toDataURL(JSON.stringify(payload), {
    errorCorrectionLevel: 'M',
    width: 256,
    margin: 2,
  });
}