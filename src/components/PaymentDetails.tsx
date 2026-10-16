import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { canRequestPayment, epcPayload, formatIban, type PaymentRequest } from '@/lib/payment';
import { formatCurrency, formatDate } from '@/lib/utils';

/**
 * Het betaalblok onder een factuur: een QR-code om te scannen met de bank-app,
 * en daarnaast dezelfde gegevens om zelf over te maken. Werkt de QR-code bij
 * een bank niet, dan staat alles er toch.
 *
 * Zonder IBAN of bedrag is er niets te betalen en toont dit niets.
 */
export default function PaymentDetails({
  payment,
  dueDate,
}: {
  payment: Partial<PaymentRequest>;
  dueDate?: string | null;
}) {
  const [qr, setQr] = useState('');
  const complete = canRequestPayment(payment);
  const payload = complete ? epcPayload(payment) : '';

  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    QRCode.toDataURL(payload, { margin: 0, width: 240, errorCorrectionLevel: 'M' })
      .then(url => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(''));
    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (!complete) return null;

  return (
    <div className="payment-details">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt="QR-code om te betalen met je bank-app" className="qr" />}
      <div>
        <strong>Betalen</strong>
        <p>
          Scan de QR-code met je bank-app, of maak {formatCurrency(payment.amount)} over
          {dueDate ? ` vóór ${formatDate(dueDate)}` : ''}.
        </p>
        <dl>
          <dt>IBAN</dt>
          <dd>{formatIban(payment.iban)}</dd>
          <dt>T.n.v.</dt>
          <dd>{payment.name}</dd>
          <dt>Omschrijving</dt>
          <dd>{payment.reference}</dd>
        </dl>
      </div>
    </div>
  );
}
