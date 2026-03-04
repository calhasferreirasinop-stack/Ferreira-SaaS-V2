import React from 'react';

interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 p-8 text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl">⚠️</div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Algo deu errado</h2>
                        <p className="text-slate-500 max-w-md">Ocorreu um erro ao carregar esta página. Não se preocupe, seus dados estão seguros.</p>
                        {this.state.error && (
                            <details className="mt-4 text-left bg-red-50 rounded-xl p-4 max-w-lg">
                                <summary className="text-red-600 font-bold cursor-pointer text-sm">Detalhes técnicos</summary>
                                <code className="text-xs text-red-500 block mt-2 whitespace-pre-wrap">{this.state.error.message}</code>
                            </details>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => { this.setState({ hasError: false, error: undefined }); window.location.reload(); }}
                            className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-2xl transition-all cursor-pointer">
                            🔄 Tentar novamente
                        </button>
                        <button onClick={() => window.location.href = '/'}
                            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-2xl transition-all cursor-pointer">
                            🏠 Ir para início
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
