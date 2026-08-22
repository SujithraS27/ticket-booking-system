import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { generateQrDataUrl } from '../src/lib/qr';
import { generateBookingReference } from '../src/lib/references';

/**
 * Proves the generated QR code actually ENCODES the booking reference:
 * the PNG data URL is decoded back to its payload with a real QR reader.
 */
describe('QR ticket generation', () => {
  it('generates a scannable QR whose payload contains the booking reference', async () => {
    const reference = generateBookingReference();
    const dataUrl = await generateQrDataUrl({
      system: 'TBS',
      ref: reference,
      event: 'Test Event',
      venue: 'Test Venue',
      startsAt: new Date().toISOString(),
      seats: ['A1', 'A2'],
      holder: 'Test User',
    });

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);

    const png = PNG.sync.read(Buffer.from(dataUrl.split(',')[1], 'base64'));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

    expect(decoded).not.toBeNull();
    const payload = JSON.parse(decoded!.data);
    expect(payload.system).toBe('TBS');
    expect(payload.ref).toBe(reference);
    expect(payload.seats).toEqual(['A1', 'A2']);
  });

  it('produces unique booking references', () => {
    const refs = new Set(Array.from({ length: 200 }, () => generateBookingReference()));
    expect(refs.size).toBe(200);
  });
});