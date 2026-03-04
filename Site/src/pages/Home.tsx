import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Shield, Clock, Star, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Settings {
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
  whatsapp?: string;
  heroImageUrl?: string;
}

interface Service {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  homeImageUrl?: string;
}

interface Testimonial {
  id: number;
  author: string;
  content: string;
  rating: number;
}

const HERO_FALLBACK = 'https://images.unsplash.com/photo-1621905235277-f25426251799?q=80&w=1920&auto=format&fit=crop';

export default function Home() {
  const [settings, setSettings] = useState<Settings>({
    heroTitle: 'Proteção e Estética para o seu Telhado',
    heroSubtitle: 'Fabricação própria de calhas e rufos com a qualidade que sua obra merece.',
    aboutText: 'Especialistas em fabricação e instalação de calhas, rufos e pingadeiras em Sinop e região.'
  });
  const [services, setServices] = useState<Service[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  useEffect(() => {
    fetch('/api/settings').then(res => res.json()).then(setSettings);
    fetch('/api/services').then(res => res.json()).then(setServices);
    fetch('/api/testimonials').then(res => res.json()).then(setTestimonials);
  }, []);

  // Foto do card de serviço na home: homeImageUrl > imageUrl > placeholder
  const getServiceHomeImage = (service: Service): string => {
    return service.homeImageUrl || service.imageUrl || `https://picsum.photos/seed/service${service.id}/600/400`;
  };

  const heroImage = settings.heroImageUrl || HERO_FALLBACK;

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center pt-20">
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover brightness-[0.4]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-50"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
              {settings.heroTitle}
            </h1>
            <p className="text-xl md:text-2xl text-slate-200 mb-10 font-light">
              {settings.heroSubtitle}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/servicos"
                className="bg-brand-primary hover:bg-brand-primary/90 text-white px-8 py-4 rounded-full font-bold transition-all flex items-center gap-2 group shadow-lg shadow-brand-primary/20"
              >
                Nossos Serviços
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#sobre"
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/30 px-8 py-4 rounded-full font-bold transition-all"
              >
                Saiba Mais
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats / Differentials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-brand-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Qualidade Garantida</h3>
              <p className="text-slate-600">Materiais de primeira linha e acabamento impecável em cada projeto.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Clock className="w-8 h-8 text-brand-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Agilidade na Entrega</h3>
              <p className="text-slate-600">Respeitamos os prazos combinados para sua total tranquilidade.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Star className="w-8 h-8 text-brand-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Experiência</h3>
              <p className="text-slate-600">Anos de atuação no mercado com centenas de clientes satisfeitos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="sobre" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="aspect-square rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="https://picsum.photos/seed/about-calhas/800/800"
                  alt="Trabalho em execução"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-8 -right-8 bg-white p-8 rounded-3xl shadow-xl hidden md:block">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold text-brand-primary">10+</div>
                  <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Anos de<br />Excelência</div>
                </div>
              </div>
            </div>
            <div>
              <span className="text-brand-primary font-bold uppercase tracking-widest text-sm mb-4 block">Sobre a Empresa</span>
              <h2 className="text-4xl font-bold text-slate-900 mb-8 leading-tight">
                Compromisso com a proteção da sua estrutura
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                {settings.aboutText}
              </p>
              <ul className="space-y-4 mb-10">
                {['Instalação profissional', 'Materiais resistentes', 'Atendimento personalizado', 'Orçamento sem compromisso'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-700 font-medium">
                    <CheckCircle2 className="w-5 h-5 text-brand-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/galeria"
                className="inline-flex items-center gap-2 text-brand-primary font-bold hover:gap-4 transition-all"
              >
                Ver nossa galeria de projetos <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Services — 1 foto estática por serviço (configurável no admin) */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossos Serviços</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">Oferecemos soluções completas para o escoamento de água e proteção do seu imóvel.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.slice(0, 3).map((service) => (
              <motion.div
                key={service.id}
                whileHover={{ y: -10 }}
                className="bg-slate-50 rounded-3xl overflow-hidden border border-slate-100 group"
              >
                <div className="h-64 overflow-hidden">
                  <img
                    src={getServiceHomeImage(service)}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-8">
                  <h3 className="text-xl font-bold mb-4">{service.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6">
                    {service.description}
                  </p>
                  <div className="flex items-center justify-between gap-4">
                    <Link to="/servicos" className="text-brand-primary font-bold text-sm flex items-center gap-2">
                      Saiba mais <ArrowRight className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => window.open(`https://wa.me/${settings.whatsapp || '5566996172808'}?text=${encodeURIComponent(`Olá, gostaria de um orçamento para ${service.title}`)}`, '_blank')}
                      className="bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white p-2 rounded-xl transition-all"
                      title="Solicitar Orçamento"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-2xl">
              <span className="text-brand-primary font-bold uppercase tracking-widest text-sm mb-4 block">Depoimentos</span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">O que nossos clientes dizem</h2>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="bg-slate-50 p-3 rounded-2xl">
                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_Logo.svg" alt="Google" className="w-8 h-8" />
              </div>
              <div>
                <div className="flex text-brand-primary mb-1">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
                <p className="text-sm font-bold text-slate-900">Avaliação 5.0 no Google</p>
                <p className="text-xs text-slate-500">Baseado em avaliações reais</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col"
              >
                <div className="flex text-brand-primary mb-6">
                  {[...Array(t.rating)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
                <p className="text-slate-600 italic mb-8 flex-grow leading-relaxed">
                  "{t.content}"
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary font-bold">
                    {t.author.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{t.author}</h4>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">Cliente Satisfeito</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-brand-primary relative overflow-hidden">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-white/10 rounded-full blur-3xl opacity-50"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">
            Pronto para proteger sua casa?
          </h2>
          <p className="text-white/90 text-lg mb-12 max-w-2xl mx-auto">
            Entre em contato agora mesmo e solicite um orçamento gratuito. Atendimento rápido e profissional.
          </p>
          <button
            onClick={() => window.open(`https://wa.me/${settings.whatsapp || '5566996172808'}`, '_blank')}
            className="bg-white text-brand-primary px-10 py-5 rounded-full font-bold text-lg hover:bg-slate-100 transition-all shadow-xl"
          >
            Falar com Especialista
          </button>
        </div>
      </section>
    </div>
  );
}
