import CourierStickerSheet from '../../components/CourierStickerSheet';
import { codAmount } from '../../utils/codAmount';
import { crossProductStickerText, crossProductCollectionTotal } from '../../utils/crossProducts';

function toSticker(card) {
  const crossProducts = crossProductStickerText(card.crossProducts);
  const total = crossProductCollectionTotal(card);
  const bookedCod = card.courier ? Number(card.courierCodAmount ?? card.codAmount ?? 0) : null;
  const mismatch = bookedCod != null && total !== bookedCod;
  return {
    key: card.Id,
    courier: card.courier,
    consignment: card.consignmentId || card.trackingCode || '',
    name: card.fullName,
    phone: card.phone,
    cod: total,
    reference: card.referenceCode,
    lines: [card.prize, crossProducts && `Cross: ${crossProducts}`],
    warning: mismatch ? `Courier booked: ${codAmount(bookedCod)} — update required` : null,
  };
}

export default function ScratchCardStickerSheet({ cards }) {
  return <CourierStickerSheet stickers={cards.map(toSticker)} />;
}
