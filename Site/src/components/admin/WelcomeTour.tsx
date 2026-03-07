import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Calculator, FileText, Send, TrendingUp, X } from 'lucide-react';

interface WelcomeTourProps {
    onComplete: () => void;
}

const steps = [
    {
        title: "Bem-vindo ao CalhaFlow! 👋",
        description: "O fluxo perfeito para o seu telhado começa aqui. Preparamos um tour rápido para você dominar as principais ferramentas.",
        icon: <Check className="w-8 h-8 text-emerald-500" />,
        color: "bg-emerald-500"
    },
    {
        title: "Orçamentos Rápidos",
        description: "Crie orçamentos profissionais em menos de 2 minutos. Adicione produtos, serviços e gere o PDF na hora.",
        icon: <FileText className="w-8 h-8 text-blue-500" />,
        color: "bg-blue-500"
    },
    {
        title: "Calculadora de Dobras",
        description: "Desenhe calhas e rufos com precisão matemática diretamente no celular. Calculamos o m² e o desenvolvimento automaticamente.",
        icon: <Calculator className="w-8 h-8 text-orange-500" />,
        color: "bg-orange-500"
    },
    {
        title: "Envio por WhatsApp",
        description: "Envie o link do orçamento para o seu cliente pelo WhatsApp com um clique. Ele verá um relatório premium e responsivo.",
        icon: <Send className="w-8 h-8 text-green-500" />,
        color: "bg-green-500"
    },
    {
        title: "Gestão Financeira",
        description: "Acompanhe seus recebíveis, contas em atraso e o faturamento do mês em um dashboard simplificado.",
        icon: <TrendingUp className="w-8 h-8 text-indigo-500" />,
        color: "bg-indigo-500"
    }
];

export function WelcomeTour({ onComplete }: WelcomeTourProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                    className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl relative"
                >
                    <button onClick={onComplete} className="absolute top-6 right-6 text-slate-300 active:text-slate-900 transition-all">
                        <X className="w-6 h-6" />
                    </button>

                    <div className="p-8 pt-12 flex flex-col items-center text-center space-y-6">
                        <div className={`w-20 h-20 rounded-[2rem] ${steps[currentStep].color}/10 flex items-center justify-center shadow-inner`}>
                            {steps[currentStep].icon}
                        </div>

                        <div className="space-y-3">
                            <h2 className="text-2xl font-black text-slate-900 leading-tight">
                                {steps[currentStep].title}
                            </h2>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed px-2">
                                {steps[currentStep].description}
                            </p>
                        </div>

                        <div className="flex gap-1.5 pt-2">
                            {steps.map((_, i) => (
                                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-8 bg-slate-900' : 'w-2 bg-slate-200'}`} />
                            ))}
                        </div>

                        <button
                            onClick={handleNext}
                            className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all mt-4"
                        >
                            {currentStep === steps.length - 1 ? 'Começar Agora' : 'Próximo'}
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
