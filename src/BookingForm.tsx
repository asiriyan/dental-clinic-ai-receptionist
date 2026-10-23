import React, { useState } from 'react';
import { Calendar, Phone, User, Check, Send } from 'lucide-react';

interface BookingFormProps {
  alreadySubmitted?: boolean;
  isLoading?: boolean;
  language?: 'English' | 'Amharic';
  onSubmit: (formattedDetails: string) => void;
}

export default function BookingForm({
  alreadySubmitted = false,
  isLoading = false,
  language = 'English',
  onSubmit,
}: BookingFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const isAmharic = language === 'Amharic';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || alreadySubmitted || isLoading) return;

    let formatted = `My details: Name: ${name.trim()}, Phone: ${phone.trim()}`;
    if (notes.trim()) {
      formatted += `, Note: ${notes.trim()}`;
    }

    onSubmit(formatted);
  };

  if (alreadySubmitted) {
    return (
      <div className="mt-3 p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-800 text-[11px] flex items-center gap-2">
        <Check className="w-4 h-4 text-teal-600 shrink-0" />
        <span>
          {isAmharic
            ? 'የቀጠሮ መረጃዎ ወደ ክሊኒኩ የፊት ለፊት ጠረጴዛ ተልኳል።'
            : 'Your patient details have been submitted to the front desk.'}
        </span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2.5 text-slate-700 text-xs"
    >
      <div className="font-semibold text-slate-800 flex items-center gap-1.5 text-[11px]">
        <Calendar className="w-3.5 h-3.5 text-teal-600" />
        <span>
          {isAmharic
            ? 'የቀጠሮ ዝርዝርዎን ያረጋግጡ'
            : 'Confirm Your Appointment Details'}
        </span>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-[10px] text-slate-500 font-medium mb-0.5">
            {isAmharic ? 'ሙሉ ስም *' : 'Full Name *'}
          </label>
          <div className="relative">
            <User className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isAmharic ? 'ለምሳሌ፡ አበበ በቀለ' : 'e.g. Abebe Bikila'}
              className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-slate-500 font-medium mb-0.5">
            {isAmharic ? 'ስልክ ቁጥር *' : 'Phone Number *'}
          </label>
          <div className="relative">
            <Phone className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0911234567 / +251 91 123 4567"
              className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-slate-500 font-medium mb-0.5">
            {isAmharic ? 'ተጨማሪ ማስታወሻ (አማራጭ)' : 'Additional Note (Optional)'}
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isAmharic
                ? 'ለምሳሌ፡ ጠዋት ይመረጣል / ጥርስ ማጽዳት'
                : 'e.g. Prefers morning / tooth cleaning'
            }
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !name.trim() || !phone.trim()}
        className="w-full mt-2 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
      >
        <Send className="w-3 h-3" />
        <span>{isAmharic ? 'ቀጠሮውን አረጋግጥ' : 'Confirm & Reserve Slot'}</span>
      </button>
    </form>
  );
}
