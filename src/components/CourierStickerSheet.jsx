import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';
import { codAmount } from '../utils/codAmount';

const STORE = { name: 'HOLY GIFT 4', hub: 'Central Inbound', contact: '09639279033' };

// 75×50mm thermal courier stickers. Each sticker:
// { key, courier, consignment, name, phone, cod (number | null), reference, lines: string[], warning }
export default function CourierStickerSheet({ stickers }) {
  return createPortal(
    <div className="pathao-sticker-print-area">
      {stickers.map((sticker) => <CourierSticker key={sticker.key} sticker={sticker} />)}
      <style>{`
        .pathao-sticker-print-area {
          position: fixed; left: -10000px; top: 0; visibility: hidden;
          print-color-adjust: exact; -webkit-print-color-adjust: exact;
        }
        .pathao-sticker {
          box-sizing: border-box; width: 75mm; height: 50mm;
          padding: 2.5mm 3mm 2mm; background: #fff; color: #000;
          font-family: Arial, Helvetica, sans-serif; line-height: 1.2;
          display: flex; flex-direction: column; overflow: hidden;
          break-inside: avoid; page-break-inside: avoid;
        }
        .pathao-sticker + .pathao-sticker { break-before: page; page-break-before: always; }
        .pathao-sticker p { margin: 0; overflow-wrap: anywhere; }
        .pathao-sticker__header { display: flex; align-items: center; gap: 3mm; flex-shrink: 0; }
        .pathao-sticker__brand { display: flex; flex-direction: column; align-items: center; width: 14mm; flex-shrink: 0; }
        .pathao-sticker__official-logo { display: block; width: 11mm; height: 11mm; color: #6d6e70; }
        .pathao-sticker__steadfast-logo { display: block; width: 10mm; height: 10mm; color: #000; }
        .pathao-sticker__brand-label { margin-top: 0.4mm; font-size: 2.6mm; font-style: italic; color: #333; }
        .pathao-sticker__courier-name { font-size: 3.2mm; font-weight: 700; }
        .pathao-sticker__store { min-width: 0; }
        .pathao-sticker__title { font-size: 3.1mm; font-weight: 700; }
        .pathao-sticker__contact { font-size: 2.4mm; }
        .pathao-sticker__consignment { margin-top: 0.3mm !important; font-size: 3.3mm; font-weight: 700; letter-spacing: 0.1mm; }
        .pathao-sticker__barcode { display: block; width: 100%; height: 12mm; margin: 2mm 0 1.6mm; flex-shrink: 0; }
        .pathao-sticker__body { flex: 1; min-height: 0; font-size: 2.6mm; }
        .pathao-sticker__name { font-size: 1.15em; font-weight: 700; }
        .pathao-sticker__phone-row { display: flex; align-items: center; gap: 1mm; margin: 0.6mm 0 0.5mm; font-size: 1.05em; }
        .pathao-sticker__cod { background: #000; color: #fff; padding: 0.1mm 1.2mm; white-space: nowrap; }
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

function CourierSticker({ sticker }) {
  const barcodeRef = useRef(null);
  const bodyRef = useRef(null);
  const { consignment = '', lines = [] } = sticker;
  const courierKey = String(sticker.courier || 'Pathao').toLowerCase();
  const isPathao = courierKey === 'pathao';
  const isSteadfast = courierKey === 'steadfast';
  const contentKey = JSON.stringify([sticker.name, sticker.phone, sticker.cod, sticker.reference, lines, sticker.warning]);

  useLayoutEffect(() => {
    if (!barcodeRef.current || !consignment) return;
    JsBarcode(barcodeRef.current, consignment, {
      format: 'CODE128', displayValue: false, margin: 0, height: 60, width: 2,
    });
    barcodeRef.current.setAttribute('preserveAspectRatio', 'none');
    barcodeRef.current.removeAttribute('width');
    barcodeRef.current.removeAttribute('height');
  }, [consignment]);

  // Long names, addresses or product lists shrink the text instead of being cut off.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let size = 2.6;
    body.style.fontSize = `${size}mm`;
    while (body.scrollHeight > body.clientHeight && size > 1.2) {
      size -= 0.1;
      body.style.fontSize = `${size}mm`;
    }
  }, [contentKey]);

  return (
    <section className="pathao-sticker" aria-label={`Courier sticker ${sticker.reference}`}>
      <header className="pathao-sticker__header">
        <div className="pathao-sticker__brand">
          {isPathao ? (
            <>
              {/* Official Pathao merchant parcel symbol, inline for reliable thermal printing.
                  Source: https://merchant.pathao.com/assets/logo_pathao_parcel-DN_VyF6-.svg */}
              <svg className="pathao-sticker__official-logo" viewBox="0 0 47.01 47" role="img" aria-label="Pathao">
                <path d="M47.0062 23.4954C47.0062 36.4752 36.4844 46.9969 23.5046 46.9969C19.3739 46.9969 15.4904 45.9271 12.1141 44.0627C9.72712 42.7301 7.5968 41.0079 5.80968 38.9611C2.18598 34.8303 0 29.4164 0 23.4954C0 21.6 0.228801 19.7542 0.649299 17.9887C1.50576 14.433 3.16302 11.1927 5.42938 8.47181C9.74568 3.29288 16.2356 0 23.5015 0C36.4844 0 47.0062 10.5156 47.0062 23.4954Z" fill="currentColor"/>
                <path d="M8.76256 18.8297C8.27714 20.0757 7.92775 21.3588 7.74533 22.5554L6.61369 28.6743C4.45245 26.0462 2.33759 22.5709 0.649414 17.9887C1.50587 14.433 3.16313 11.1927 5.42949 8.4718C6.20556 12.3738 7.33101 15.8522 8.76256 18.8297Z" fill="white"/>
                <path d="M32.8082 33.8687C28.5259 37.7366 21.7732 38.4694 15.5894 35.7269C15.339 35.6125 15.0762 35.4919 14.8072 35.3559L16.1676 27.9322C16.9158 28.4238 17.6857 28.8598 18.4834 29.2154C22.0886 30.817 25.836 30.5696 28.0312 28.5815C30.4182 26.4234 31.1942 23.4582 30.1121 20.6508C29.2865 18.4926 27.1408 16.1923 23.6005 16.1923C23.6005 16.1923 23.5944 16.1923 23.5851 16.1923C17.2436 16.1923 15.9543 23.0872 15.8337 23.8725L15.812 23.9715L15.2122 27.2427L13.8147 34.8303L12.111 44.0627C9.72408 42.7301 7.59376 41.0079 5.80664 38.961L7.51028 29.7132L8.79342 22.7316C8.94183 21.7762 9.20773 20.7714 9.55712 19.7758C9.6004 19.649 9.64369 19.5192 9.69316 19.3831C9.75809 19.2131 9.82921 19.0399 9.89414 18.8699C9.94361 18.7555 9.98689 18.6411 10.0364 18.5205C10.1137 18.3504 10.1848 18.1773 10.2713 18.0072C10.327 17.8866 10.3857 17.7568 10.4507 17.6362C10.5218 17.4723 10.5991 17.3146 10.6857 17.16C10.7722 16.99 10.8712 16.8168 10.9639 16.6468C11.0289 16.5386 11.0845 16.4272 11.1494 16.319C13.388 12.5438 17.3116 9.06543 23.5882 9.06543H23.616C29.4999 9.07161 34.6572 12.6118 36.7659 18.0907C38.9055 23.6747 37.3873 29.7162 32.8082 33.8687Z" fill="white"/>
              </svg>
              <span className="pathao-sticker__brand-label">merchant</span>
            </>
          ) : isSteadfast ? (
            <>
              {/* Official Steadfast kite mark in its mono-black variant, inline for reliable thermal printing.
                  Source: the sf-logo SVG on https://steadfast.com.bd */}
              <svg className="pathao-sticker__steadfast-logo" viewBox="303 831 338 338" role="img" aria-label="Steadfast">
                <path d="M640.36,856.8v170.38c0,4.02-5.75,4.71-6.69.8-9.97-41.71-30.1-79.47-57.65-110.5-1.2-1.35-1.15-3.38.12-4.66l58.42-58.42c2.14-2.14,5.8-.62,5.8,2.4Z" fill="currentColor"/>
                <path d="M617.45,837.29l-58.43,58.42c-1.27,1.27-3.31,1.32-4.66.12-31.03-27.55-68.79-47.69-110.5-57.65-3.91-.93-3.23-6.69.8-6.69h170.39c3.03,0,4.54,3.66,2.4,5.8Z" fill="currentColor"/>
                <path d="M537.08,917.65l-147.3,147.3c-2.14,2.14-5.8.62-5.8-2.4v-203.78c0-1.89,1.55-3.44,3.44-3.41,57.22.83,109.43,22.32,149.52,57.34,1.48,1.29,1.54,3.58.15,4.96Z" fill="currentColor"/>
                <path d="M613.1,1087.86h-203.8c-3.03,0-4.54-3.66-2.4-5.8l147.3-147.3c1.39-1.39,3.67-1.33,4.96.15,35.02,40.09,56.52,92.29,57.35,149.52.03,1.89-1.52,3.44-3.41,3.44Z" fill="currentColor"/>
                <path d="M383.97,1091.26v73.85c0,3.03-3.66,4.54-5.8,2.4l-28.36-28.36-45.49-45.49c-2.14-2.14-.62-5.8,2.4-5.8h73.85c1.88,0,3.4,1.52,3.4,3.4Z" fill="currentColor"/>
              </svg>
              <span className="pathao-sticker__brand-label">steadfast</span>
            </>
          ) : (
            <span className="pathao-sticker__courier-name">{String(sticker.courier).toUpperCase()}</span>
          )}
        </div>
        <div className="pathao-sticker__store">
          <p className="pathao-sticker__title">{STORE.name}</p>
          <p className="pathao-sticker__title">{STORE.name} - {STORE.hub}</p>
          <p className="pathao-sticker__contact">Contact: {STORE.contact}</p>
          <p className="pathao-sticker__consignment">{consignment}</p>
        </div>
      </header>
      <svg ref={barcodeRef} className="pathao-sticker__barcode" aria-label={`Barcode ${consignment}`} />
      <div ref={bodyRef} className="pathao-sticker__body">
        <p className="pathao-sticker__name">{sticker.name}</p>
        <p className="pathao-sticker__phone-row">
          <span>{sticker.phone}</span>
          <span>|</span>
          <span className="pathao-sticker__cod">COD: {sticker.cod == null ? 'Price required' : codAmount(sticker.cod)}</span>
        </p>
        <p>Order ID: {sticker.reference}</p>
        {lines.filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
        {sticker.warning && <p className="pathao-sticker__mismatch">{sticker.warning}</p>}
      </div>
    </section>
  );
}
