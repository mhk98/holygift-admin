import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';

// Header details printed on every sticker, as on Pathao's own merchant label.
// Update these if the Pathao store or pickup hub changes.
const PATHAO_STORE = {
  name: 'HOLY GIFT 4',
  hub: 'Central Inbound',
  contact: '09639279033',
};

// Pathao's standard thermal sticker: 75mm x 50mm, one sticker per page.
// Rendered straight into <body> so printing can drop the whole app layout;
// inside the scrolling page the stickers land off the printed page.
export default function PathaoStickerSheet({ cards }) {
  return createPortal(
    <div className="pathao-sticker-print-area">
      {cards.map((card) => <PathaoSticker key={card.Id} card={card} />)}

      <style>{`
        .pathao-sticker-print-area {
          display: none;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        .pathao-sticker {
          box-sizing: border-box;
          width: 75mm;
          height: 50mm;
          padding: 2mm 2.5mm;
          border: 0.3mm solid #000;
          background: #fff;
          color: #000;
          font-family: Roboto, Arial, Helvetica, sans-serif;
          overflow: hidden;
          break-after: page;
          page-break-after: always;
        }

        .pathao-sticker:last-child {
          break-after: auto;
          page-break-after: auto;
        }

        .pathao-sticker__head {
          display: flex;
          align-items: center;
          gap: 2mm;
        }

        .pathao-sticker__logo {
          flex-shrink: 0;
          width: 17mm;
          text-align: center;
        }

        .pathao-sticker__logo-mark {
          display: block;
          width: 12mm;
          height: 12mm;
          margin: 0 auto;
          color: #707070;
        }

        .pathao-sticker__logo-text {
          display: block;
          margin-top: 0.3mm;
          font-size: 10px;
          font-style: italic;
        }

        .pathao-sticker__store {
          min-width: 0;
          line-height: 1.15;
        }

        .pathao-sticker__store p {
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pathao-sticker__store-name {
          font-size: 11px;
          font-weight: 700;
        }

        .pathao-sticker__contact {
          font-size: 9px;
        }

        .pathao-sticker__barcode {
          display: block;
          width: 100%;
          height: 11mm;
          margin: 1.2mm 0 0.8mm;
        }

        .pathao-sticker__body p {
          margin: 0;
          font-size: 10px;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pathao-sticker__name {
          font-weight: 700;
        }

        .pathao-sticker__cod {
          background: #000;
          color: #fff;
          padding: 0 1mm;
        }

        @media print {
          @page {
            size: 75mm 50mm;
            margin: 0;
          }

          html,
          body {
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }

          body > *:not(.pathao-sticker-print-area) {
            display: none !important;
          }

          .pathao-sticker-print-area {
            display: block !important;
            background: #fff;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}

function PathaoSticker({ card }) {
  const barcodeRef = useRef(null);
  const consignment = card.consignmentId || card.trackingCode || '';

  useEffect(() => {
    if (!barcodeRef.current || !consignment) return;
    // Code128 so Pathao's scanners can read the consignment ID.
    JsBarcode(barcodeRef.current, consignment, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height: 60,
      width: 2,
    });
    // Stretch to the sticker width instead of the barcode's natural pixel size.
    barcodeRef.current.setAttribute('preserveAspectRatio', 'none');
    barcodeRef.current.removeAttribute('width');
    barcodeRef.current.removeAttribute('height');
  }, [consignment]);

  const cod = Number(card.codAmount ?? card.deliveryCharge ?? 0).toFixed(2);

  return (
    <div className="pathao-sticker">
      <div className="pathao-sticker__head">
        <div className="pathao-sticker__logo">
          {/* Official Pathao symbol, monochrome for thermal printing.
              Source: https://merchant.pathao.com/assets/logo_pathao_parcel-DN_VyF6-.svg */}
          <svg className="pathao-sticker__logo-mark" viewBox="0 0 47.01 47" role="img" aria-label="Pathao">
            <path d="M47.0062 23.4954C47.0062 36.4752 36.4844 46.9969 23.5046 46.9969C19.3739 46.9969 15.4904 45.9271 12.1141 44.0627C9.72712 42.7301 7.5968 41.0079 5.80968 38.9611C2.18598 34.8303 0 29.4164 0 23.4954C0 21.6 0.228801 19.7542 0.649299 17.9887C1.50576 14.433 3.16302 11.1927 5.42938 8.47181C9.74568 3.29288 16.2356 0 23.5015 0C36.4844 0 47.0062 10.5156 47.0062 23.4954Z" fill="currentColor"/>
            <path d="M8.76256 18.8297C8.27714 20.0757 7.92775 21.3588 7.74533 22.5554L6.61369 28.6743C4.45245 26.0462 2.33759 22.5709 0.649414 17.9887C1.50587 14.433 3.16313 11.1927 5.42949 8.4718C6.20556 12.3738 7.33101 15.8522 8.76256 18.8297Z" fill="white"/>
            <path d="M32.8082 33.8687C28.5259 37.7366 21.7732 38.4694 15.5894 35.7269C15.339 35.6125 15.0762 35.4919 14.8072 35.3559L16.1676 27.9322C16.9158 28.4238 17.6857 28.8598 18.4834 29.2154C22.0886 30.817 25.836 30.5696 28.0312 28.5815C30.4182 26.4234 31.1942 23.4582 30.1121 20.6508C29.2865 18.4926 27.1408 16.1923 23.6005 16.1923C23.6005 16.1923 23.5944 16.1923 23.5851 16.1923C17.2436 16.1923 15.9543 23.0872 15.8337 23.8725L15.812 23.9715L15.2122 27.2427L13.8147 34.8303L12.111 44.0627C9.72408 42.7301 7.59376 41.0079 5.80664 38.961L7.51028 29.7132L8.79342 22.7316C8.94183 21.7762 9.20773 20.7714 9.55712 19.7758C9.6004 19.649 9.64369 19.5192 9.69316 19.3831C9.75809 19.2131 9.82921 19.0399 9.89414 18.8699C9.94361 18.7555 9.98689 18.6411 10.0364 18.5205C10.1137 18.3504 10.1848 18.1773 10.2713 18.0072C10.327 17.8866 10.3857 17.7568 10.4507 17.6362C10.5218 17.4723 10.5991 17.3146 10.6857 17.16C10.7722 16.99 10.8712 16.8168 10.9639 16.6468C11.0289 16.5386 11.0845 16.4272 11.1494 16.319C13.388 12.5438 17.3116 9.06543 23.5882 9.06543H23.616C29.4999 9.07161 34.6572 12.6118 36.7659 18.0907C38.9055 23.6747 37.3873 29.7162 32.8082 33.8687Z" fill="white"/>
          </svg>
          <span className="pathao-sticker__logo-text">merchant</span>
        </div>
        <div className="pathao-sticker__store">
          <p className="pathao-sticker__store-name">{PATHAO_STORE.name}</p>
          <p className="pathao-sticker__store-name">{PATHAO_STORE.name} - {PATHAO_STORE.hub}</p>
          <p className="pathao-sticker__contact">Contact: {PATHAO_STORE.contact}</p>
          <p className="pathao-sticker__store-name">{consignment}</p>
        </div>
      </div>

      <svg ref={barcodeRef} className="pathao-sticker__barcode" aria-label={`Barcode ${consignment}`} />

      <div className="pathao-sticker__body">
        <p className="pathao-sticker__name">{card.fullName}</p>
        <p>{card.phone} | <span className="pathao-sticker__cod">COD: BDT {cod}</span></p>
        <p>Order ID: {card.referenceCode}</p>
        <p>{card.prize}</p>
      </div>
    </div>
  );
}
