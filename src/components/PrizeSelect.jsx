import { useEffect, useState } from 'react';
import Select from 'react-select';
import { scratchCardPrizeService } from '../services/scratchCardService';
import { imageUrl } from '../utils/assetUrl';

const SELECT_STYLES = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    fontSize: 13,
    borderRadius: 6,
    borderColor: state.isFocused ? '#60a5fa' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 1px #93c5fd' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#60a5fa' : '#9ca3af' },
  }),
  menu: (base) => ({ ...base, fontSize: 13 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  multiValue: (base) => ({ ...base, backgroundColor: '#eff6ff', borderRadius: 4 }),
  multiValueLabel: (base) => ({ ...base, color: '#1d4ed8' }),
};

const prizeLabel = (prize) =>
  prize.nameBn ? `${prize.nameBn} (${prize.name})` : prize.name;

function formatOption(option) {
  return (
    <div className="flex items-center gap-2">
      {option.image && (
        <img src={imageUrl(option.image)} alt="" className="w-5 h-5 rounded object-cover" />
      )}
      <span>{option.label}</span>
    </div>
  );
}

// Multi-select of the scratch card prizes; `value` is an array of prize Ids.
export default function PrizeSelect({ value = [], onChange }) {
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    scratchCardPrizeService.getAll()
      .catch(() => scratchCardPrizeService.getPublic())
      .then((r) => setPrizes(Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []))
      .catch(() => setPrizes([]))
      .finally(() => setLoading(false));
  }, []);

  const options = prizes.map((prize) => ({
    value: Number(prize.Id),
    label: prize.status === 'Inactive' ? `${prizeLabel(prize)} — Inactive` : prizeLabel(prize),
    image: prize.image,
  }));
  const selected = options.filter((option) => value.includes(option.value));

  return (
    <div className="w-full max-w-md">
      <Select
        isMulti
        // Product form cards clip overflow, so the menu renders on <body>.
        menuPortalTarget={document.body}
        menuPosition="fixed"
        isLoading={loading}
        options={options}
        value={selected}
        onChange={(items) => onChange((items || []).map((item) => item.value))}
        formatOptionLabel={formatOption}
        closeMenuOnSelect={false}
        placeholder="Select prize..."
        noOptionsMessage={() => 'কোনো prize নেই — Scratch Card › Prizes থেকে add করুন'}
        styles={SELECT_STYLES}
      />
    </div>
  );
}
