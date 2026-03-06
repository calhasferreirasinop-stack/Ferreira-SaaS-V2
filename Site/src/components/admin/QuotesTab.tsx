import React, { useState, useEffect } from 'react';
import QuotesTabMobile from './QuotesTabMobile';
import QuotesTabDesktop from './QuotesTabDesktop';

interface QuotesTabProps {
    quotes: any[];
    fetchData: (s?: boolean) => void;
    showToast: (m: string, t: 'success' | 'error') => void;
}

export default function QuotesTab(props: QuotesTabProps) {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile ? <QuotesTabMobile {...props} /> : <QuotesTabDesktop {...props} />;
}
