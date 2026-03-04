import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize2, X, Filter } from 'lucide-react';

interface GalleryItem {
  id: number;
  imageUrl: string;
  description: string;
  serviceId: number | null;
}

interface Service {
  id: number;
  title: string;
}

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/gallery').then(res => res.json()),
      fetch('/api/services').then(res => res.json())
    ]).then(([galleryData, servicesData]) => {
      setItems(galleryData);
      setServices(servicesData);
    });
  }, []);

  const filteredItems = activeFilter 
    ? items.filter(item => item.serviceId === activeFilter)
    : items;

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section - Immersive Style */}
      <section className="relative h-[60vh] flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=1920&auto=format&fit=crop"
            alt="Gallery Hero"
            className="w-full h-full object-cover brightness-[0.4]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-transparent to-white"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-white">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="h-[1px] w-12 bg-brand-primary"></div>
            <span className="text-brand-primary font-bold uppercase tracking-[0.2em] text-xs">Portfólio</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-8xl font-bold mb-8 tracking-tighter"
          >
            Nossa <span className="italic font-serif">Galeria</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-200 max-w-xl text-lg md:text-xl font-light leading-relaxed"
          >
            Explore a excelência técnica e o acabamento superior em cada um de nossos projetos realizados em Sinop e região.
          </motion.p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Filters - Sticky Clean Utility Style */}
        <div className="sticky top-24 z-30 bg-white/80 backdrop-blur-md py-4 -mx-4 px-4 mb-16 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-slate-400 mr-4">
            <Filter size={18} />
            <span className="text-sm font-medium uppercase tracking-wider">Filtrar:</span>
          </div>
          <button
            onClick={() => setActiveFilter(null)}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
              activeFilter === null 
                ? 'bg-brand-dark text-white shadow-lg shadow-brand-dark/20' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => setActiveFilter(service.id)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                activeFilter === service.id 
                  ? 'bg-brand-dark text-white shadow-lg shadow-brand-dark/20' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {service.title}
            </button>
          ))}
        </div>

        {/* Masonry Grid - Refined */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-8 space-y-8">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4 }}
                className="relative group cursor-pointer rounded-3xl overflow-hidden shadow-sm break-inside-avoid bg-slate-100"
                onClick={() => setSelectedImage(item.imageUrl)}
              >
                <img
                  src={item.imageUrl}
                  alt={item.description}
                  className="w-full h-auto object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-75"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 flex flex-col justify-end p-8 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-gradient-to-t from-black/90 via-black/20 to-transparent translate-y-4 group-hover:translate-y-0">
                  <div className="bg-white/10 backdrop-blur-xl p-6 rounded-[2rem] border border-white/20">
                    <p className="text-white text-sm font-medium mb-4 leading-relaxed">{item.description || 'Projeto Ferreira Calhas'}</p>
                    <div className="flex items-center gap-2 text-brand-primary text-xs font-bold uppercase tracking-[0.2em]">
                      <Maximize2 className="w-4 h-4" /> Ver Detalhes
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-32 bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">Nenhum projeto encontrado nesta categoria.</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/98 flex items-center justify-center p-4 md:p-10"
            onClick={() => setSelectedImage(null)}
          >
            <button
              className="absolute top-8 right-8 text-white p-3 hover:bg-white/10 rounded-full transition-all hover:rotate-90"
              onClick={() => setSelectedImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative max-w-7xl max-h-full"
            >
              <img
                src={selectedImage}
                alt="Project detail"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
