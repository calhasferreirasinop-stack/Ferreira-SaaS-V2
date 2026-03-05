import { MessageCircle, X, Hammer, Shield, Droplets, Settings as SettingsIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function WhatsAppButton() {
  const [whatsapp, setWhatsapp] = useState('5566996172808');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.whatsapp) setWhatsapp(data.whatsapp);
      })
      .catch(err => console.error('Error fetching whatsapp:', err));
  }, []);

  const options = [
    { id: 'manutencao', label: 'Manutenção / Reparo', icon: Hammer, color: 'bg-blue-500' },
    { id: 'nova_calha', label: 'Nova Calha', icon: Droplets, color: 'bg-emerald-500' },
    { id: 'nova_pingadeira', label: 'Nova Pingadeira', icon: Shield, color: 'bg-amber-500' },
    { id: 'outros', label: 'Outros Serviços', icon: SettingsIcon, color: 'bg-slate-500' },
  ];

  const handleSelectOption = (optionLabel: string) => {
    const message = encodeURIComponent(`Olá! Gostaria de solicitar um orçamento para: ${optionLabel}.`);
    window.open(`https://wa.me/${whatsapp}?text=${message}`, '_blank');
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-white p-4 rounded-full shadow-2xl hover:bg-emerald-600 hover:scale-110 transition-all group flex items-center gap-2"
        aria-label="Contato via WhatsApp"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 font-medium whitespace-nowrap">
          Solicitar Orçamento
        </span>
      </button>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors p-2"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="mb-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6">
                  <MessageCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Como podemos ajudar?</h3>
                <p className="text-slate-500">Selecione o serviço desejado para iniciarmos seu atendimento via WhatsApp.</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(opt.label)}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 hover:ring-2 hover:ring-emerald-500/20 transition-all group text-left"
                  >
                    <div className={`${opt.color} text-white p-3 rounded-xl shadow-lg shadow-current/10 group-hover:scale-110 transition-transform`}>
                      <opt.icon className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-slate-700">{opt.label}</span>
                  </button>
                ))}
              </div>

              <p className="mt-8 text-center text-xs text-slate-400 font-medium uppercase tracking-widest">
                Ferreira Calhas & Rufos
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
