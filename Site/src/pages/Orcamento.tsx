import React, { useState, useEffect } from 'react';
import OrcamentoMobile from './OrcamentoMobile';
import OrcamentoDesktop from './OrcamentoDesktop';

export default function Orcamento() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile ? <OrcamentoMobile /> : <OrcamentoDesktop />;
}
