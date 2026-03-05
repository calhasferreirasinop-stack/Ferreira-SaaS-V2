import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Droplets, ShieldCheck, Wrench, ArrowRight, CheckCircle2 } from 'lucide-react';
import ImageCarousel from '../components/ImageCarousel';

interface Service {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
}

interface GalleryItem {
  id: number;
  imageUrl: string;
  serviceId: number;
}

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    Promise.all([
      fetch('/api/services').then(res => res.json()),
      fetch('/api/gallery').then(res => res.json()),
      fetch('/api/settings').then(res => res.json())
    ]).then(([servicesData, galleryData, settingsData]) => {
      setServices(servicesData);
      setGallery(galleryData);
      setSettings(settingsData);
    });
  }, []);

  const getServiceImages = (serviceId: number): string[] => {
    const galleryImages = gallery
      .filter(item => item.serviceId === serviceId)
      .map(item => item.imageUrl);
    // show gallery images; use the service image only as fallback if no gallery images
    return galleryImages;
  };

  const icons = [Droplets, ShieldCheck, Wrench, Wrench, Wrench];

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold uppercase tracking-wider mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
              Nossa Expertise
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold text-slate-900 leading-[1.1] mb-8 tracking-tight"
            >
              Soluções que <span className="text-brand-primary">protegem</span> sua estrutura.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-600 leading-relaxed mb-10 font-light"
            >
              De calhas residenciais a grandes projetos industriais, oferecemos o que há de melhor em fabricação e instalação em Sinop.
            </motion.p>
          </div>
        </div>

        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-50 -z-10 hidden lg:block">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#141414 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-24">
            {services.map((service, index) => {
              const serviceImages = getServiceImages(service.id);
              const Icon = icons[index] ?? Wrench;

              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
                >
                  {/* Image / Carousel side */}
                  <div className={`${index % 2 !== 0 ? 'lg:order-last' : ''}`}>
                    <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl group">
                      {serviceImages.length > 0 ? (
                        <ImageCarousel
                          images={serviceImages}
                          alt={service.title}
                          className="rounded-3xl"
                        />
                      ) : (
                        /* Fallback: placeholder when no gallery photos yet */
                        <div className="w-full h-full bg-slate-200 flex flex-col items-center justify-center gap-3 text-slate-400">
                          <Icon size={48} />
                          <p className="text-sm font-medium">Adicione fotos no painel admin</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Text side */}
                  <div className="flex flex-col gap-6">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-brand-primary border border-slate-100">
                      <Icon size={32} />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">{service.title}</h2>
                    <p className="text-lg text-slate-600 leading-relaxed">
                      {service.description}
                    </p>

                    <ul className="space-y-4 mt-4">
                      {[
                        'Materiais de primeira linha',
                        'Instalação profissional e limpa',
                        'Garantia de estanqueidade',
                        'Acabamento impecável'
                      ].map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-slate-700 font-medium">
                          <CheckCircle2 className="text-brand-primary w-5 h-5" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8 flex flex-wrap gap-4">
                      <a
                        href={`https://wa.me/${settings.whatsapp || '5566996172808'}?text=${encodeURIComponent(`Olá, gostaria de um orçamento para ${service.title}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-brand-dark text-white px-8 py-4 rounded-full font-bold hover:bg-brand-primary transition-all group shadow-lg shadow-brand-dark/10"
                      >
                        Solicitar Orçamento
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">Por que escolher a Ferreira Calhas?</h2>
            <p className="text-lg text-slate-600 font-light">Combinamos técnica avançada com atendimento personalizado para entregar o melhor resultado.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Fabricação Própria',
                desc: 'Controlamos todo o processo, desde a dobra da chapa até a instalação final.',
                icon: <Wrench className="w-8 h-8" />
              },
              {
                title: 'Durabilidade Extrema',
                desc: 'Utilizamos metais com tratamento anticorrosivo para garantir anos de proteção.',
                icon: <ShieldCheck className="w-8 h-8" />
              },
              {
                title: 'Equipe Especializada',
                desc: 'Nossos profissionais são treinados para trabalhar com segurança e precisão.',
                icon: <CheckCircle2 className="w-8 h-8" />
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-brand-primary/30 transition-colors group"
              >
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-brand-primary mb-8 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-4">{item.title}</h4>
                <p className="text-slate-600 leading-relaxed mb-6">{item.desc}</p>
                <button
                  onClick={() => window.open(`https://wa.me/${settings.whatsapp || '5566996172808'}`, '_blank')}
                  className="text-brand-primary font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all"
                >
                  Falar com a Equipe <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
