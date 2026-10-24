import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';
import { crossProductStickerText, crossProductCollectionTotal } from '../../utils/crossProducts';

const STORE = { name: 'HOLY GIFT 4', contact: '09639279033' };
const money = (value) => `৳${Number(value).toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;

export default function PathaoStickerSheet({ cards }) {
  return createPortal(
    <div className="pathao-sticker-print-area">
      {cards.map((card) => <PathaoSticker key={card.Id} card={card} />)}
      <style>{`
        .pathao-sticker-print-area {
          position: fixed; left: -10000px; top: 0; visibility: hidden;
          print-color-adjust: exact; -webkit-print-color-adjust: exact;
        }
        .pathao-sticker {
          box-sizing: border-box; width: 75mm; height: 50mm;
          padding: 1.5mm; border: 0.25mm solid #ccc; background: #fff; color: #111;
          font-family: Arial, Helvetica, sans-serif; font-size: 7px; line-height: 1.35;
          display: flex; flex-direction: column; overflow: hidden;
          break-inside: avoid; page-break-inside: avoid;
        }
        .pathao-sticker + .pathao-sticker { break-before: page; page-break-before: always; }
        .pathao-sticker p { margin: 0; overflow-wrap: anywhere; }
        .pathao-sticker__header, .pathao-sticker__shipment {
          display: flex; justify-content: space-between; align-items: center; gap: 2mm;
          flex-shrink: 0;
        }
        .pathao-sticker__header { padding: 0.7mm 0 2.5mm; border-bottom: 0.2mm solid #ccc; }
        .pathao-sticker__store { font-size: 9px; font-weight: 700; }
        .pathao-sticker__official-logo { display: block; width: 5mm; height: 5mm; flex-shrink: 0; color: #111; }
        .pathao-sticker__provider { display: flex; align-items: center; gap: 1mm; font-size: 7px; font-weight: 700; white-space: nowrap; }
        .pathao-sticker__shipment { padding: 2.5mm 0 1.5mm; font-size: 8px; font-weight: 700; }
        .pathao-sticker__amount { white-space: nowrap; }
        .pathao-sticker__barcode { display: block; width: 100%; height: 7mm; flex-shrink: 0; }
        .pathao-sticker__body { flex: 1; min-height: 0; margin-top: 2mm; font-size: 7px; }
        .pathao-sticker__customer { border-top: 0.2mm solid #ccc; border-bottom: 0.2mm solid #ddd; padding: 1.6mm 0; }
        .pathao-sticker__name { font-size: 1.15em; font-weight: 700; margin-bottom: 0.7mm !important; }
        .pathao-sticker__details { padding-top: 1.6mm; }
        .pathao-sticker__details p + p { margin-top: 0.2mm; }
        .pathao-sticker__mismatch { font-weight: 700; }
        @media print {
          @page { size: 75mm 50mm; margin: 0; }
          html, body { height: auto !important; min-height: 0 !important; margin: 0 !important;
            padding: 0 !important; overflow: visible !important; background: #fff !important; }
          body > *:not(.pathao-sticker-print-area) { display: none !important; }
          .pathao-sticker-print-area { display: block !important; position: static; visibility: visible; }
        }
      `}</style>
    </div>, document.body,
  );
}

function PathaoSticker({ card }) {
  const barcodeRef = useRef(null);
  const bodyRef = useRef(null);
  const consignment = card.consignmentId || card.trackingCode || '';
  const crossProducts = crossProductStickerText(card.crossProducts);
  const total = crossProductCollectionTotal(card);
  const bookedCod = card.courier ? Number(card.courierCodAmount ?? card.codAmount ?? 0) : null;
  const mismatch = bookedCod != null && total !== bookedCod;

  useLayoutEffect(() => {
    if (!barcodeRef.current || !consignment) return;
    JsBarcode(barcodeRef.current, consignment, {
      format: 'CODE128', displayValue: false, margin: 0, marginLeft: 10, marginRight: 10, height: 40, width: 2,
    });
    barcodeRef.current.setAttribute('preserveAspectRatio', 'none');
    barcodeRef.current.removeAttribute('width');
    barcodeRef.current.removeAttribute('height');
  }, [consignment]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let size = 7;
    body.style.fontSize = `${size}px`;
    while (body.scrollHeight > body.clientHeight && size > 1) {
      size -= 0.25;
      body.style.fontSize = `${size}px`;
    }
  }, [crossProducts, card.fullName, card.phone, card.address, card.prize, card.referenceCode, mismatch, bookedCod]);

  return (
    <section className="pathao-sticker" aria-label={`Courier sticker ${card.referenceCode}`}>
      <header className="pathao-sticker__header">
        <strong className="pathao-sticker__store">{STORE.name}</strong>
        <span className="pathao-sticker__provider">
          {/* Official Pathao merchant parcel symbol, inline for reliable thermal printing.
              Source: https://merchant.pathao.com/assets/logo_pathao_parcel-DN_VyF6-.svg */}
          {String(card.courier || 'Pathao').toLowerCase() === 'pathao' && (
            <svg className="pathao-sticker__official-logo" viewBox="0 0 47.01 47" role="img" aria-label="Pathao">
            <path d="M47.0062 23.4954C47.0062 36.4752 36.4844 46.9969 23.5046 46.9969C19.3739 46.9969 15.4904 45.9271 12.1141 44.0627C9.72712 42.7301 7.5968 41.0079 5.80968 38.9611C2.18598 34.8303 0 29.4164 0 23.4954C0 21.6 0.228801 19.7542 0.649299 17.9887C1.50576 14.433 3.16302 11.1927 5.42938 8.47181C9.74568 3.29288 16.2356 0 23.5015 0C36.4844 0 47.0062 10.5156 47.0062 23.4954Z" fill="currentColor"/>
            <path d="M8.76256 18.8297C8.27714 20.0757 7.92775 21.3588 7.74533 22.5554L6.61369 28.6743C4.45245 26.0462 2.33759 22.5709 0.649414 17.9887C1.50587 14.433 3.16313 11.1927 5.42949 8.4718C6.20556 12.3738 7.33101 15.8522 8.76256 18.8297Z" fill="white"/>
            <path d="M32.8082 33.8687C28.5259 37.7366 21.7732 38.4694 15.5894 35.7269C15.339 35.6125 15.0762 35.4919 14.8072 35.3559L16.1676 27.9322C16.9158 28.4238 17.6857 28.8598 18.4834 29.2154C22.0886 30.817 25.836 30.5696 28.0312 28.5815C30.4182 26.4234 31.1942 23.4582 30.1121 20.6508C29.2865 18.4926 27.1408 16.1923 23.6005 16.1923C23.6005 16.1923 23.5944 16.1923 23.5851 16.1923C17.2436 16.1923 15.9543 23.0872 15.8337 23.8725L15.812 23.9715L15.2122 27.2427L13.8147 34.8303L12.111 44.0627C9.72408 42.7301 7.59376 41.0079 5.80664 38.961L7.51028 29.7132L8.79342 22.7316C8.94183 21.7762 9.20773 20.7714 9.55712 19.7758C9.6004 19.649 9.64369 19.5192 9.69316 19.3831C9.75809 19.2131 9.82921 19.0399 9.89414 18.8699C9.94361 18.7555 9.98689 18.6411 10.0364 18.5205C10.1137 18.3504 10.1848 18.1773 10.2713 18.0072C10.327 17.8866 10.3857 17.7568 10.4507 17.6362C10.5218 17.4723 10.5991 17.3146 10.6857 17.16C10.7722 16.99 10.8712 16.8168 10.9639 16.6468C11.0289 16.5386 11.0845 16.4272 11.1494 16.319C13.388 12.5438 17.3116 9.06543 23.5882 9.06543H23.616C29.4999 9.07161 34.6572 12.6118 36.7659 18.0907C38.9055 23.6747 37.3873 29.7162 32.8082 33.8687Z" fill="white"/>
          </svg>
          )}
          <span>{String(card.courier || 'Pathao').toUpperCase()} · COD</span>
        </span>
      </header>
      <div className="pathao-sticker__shipment">
        <span>{consignment}</span>
        <span className="pathao-sticker__amount">{total == null ? 'Price required' : money(total)}</span>
      </div>
      <svg ref={barcodeRef} className="pathao-sticker__barcode" aria-label={`Barcode ${consignment}`} />
      <div ref={bodyRef} className="pathao-sticker__body">
        <div className="pathao-sticker__customer">
          <p className="pathao-sticker__name">{card.fullName} · {card.phone}</p>
          <p>Address: {card.address || '—'}</p>
        </div>
        <div className="pathao-sticker__details">
          <p>Order: {card.referenceCode}</p>
          <p>{card.prize}</p>
          {crossProducts && <p>Cross: {crossProducts}</p>}
          <p>Merchant Contact: {STORE.contact}</p>
          {mismatch && <p className="pathao-sticker__mismatch">Courier booked: {money(bookedCod)} — update required</p>}
        </div>
      </div>
    </section>
  );
}
