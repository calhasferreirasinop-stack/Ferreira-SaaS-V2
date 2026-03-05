import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar, User, ArrowRight } from 'lucide-react';

interface Post {
  id: number;
  title: string;
  content: string;
  imageUrl: string;
  createdAt: string;
}

export default function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetch('/api/posts').then(res => res.json()).then(setPosts);
  }, []);

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[50vh] flex items-center pt-20">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1541888946425-d81bb19480c5?q=80&w=1920&auto=format&fit=crop"
            alt="Blog Hero"
            className="w-full h-full object-cover brightness-[0.3]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 to-slate-50"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-white text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-6"
          >
            Blog e Novidades
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-200 max-w-2xl mx-auto text-lg md:text-xl font-light"
          >
            Acompanhe nossos projetos, dicas de manutenção e as últimas novidades da Ferreira Calhas.
          </motion.p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.length > 0 ? (
            posts.map((post) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 flex flex-col group"
              >
                <div className="h-56 overflow-hidden">
                  <img
                    src={post.imageUrl || 'https://picsum.photos/seed/blog/800/600'}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-8 flex-grow flex flex-col">
                  <div className="flex items-center gap-4 text-xs text-slate-400 mb-4 font-medium uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(post.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> Ferreira Calhas</span>
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-slate-900 group-hover:text-brand-primary transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6 line-clamp-3">
                    {post.content}
                  </p>
                  <div className="mt-auto">
                    <button className="text-brand-primary font-bold text-sm flex items-center gap-2 group-hover:gap-3 transition-all">
                      Ler mais <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))
          ) : (
            <div className="col-span-full text-center py-20">
              <p className="text-slate-400 italic">Nenhuma publicação encontrada no momento.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
