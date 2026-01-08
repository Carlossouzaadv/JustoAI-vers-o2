'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

// Icon name mapping to file paths
const ICON_PATHS = {
    // Custom SVG icons
    cliente: '/icons/cliente.svg',
    documentos: '/icons/documentos.svg',
    ia: '/icons/ia.svg',
    calendario: '/icons/calendario.svg',
    creditos: '/icons/creditos.svg',
    tempo: '/icons/tempo.svg',
    upload: '/icons/upload.svg',
    atencao: '/icons/atencao.svg',

    // PNG versions (larger/detailed)
    'cliente-png': '/optimized/cliente.png',
    'documentos-png': '/optimized/documentos.png',
    'ia-png': '/optimized/IA.png',
    'calendario-png': '/optimized/calendário.png',
    'creditos-png': '/optimized/creditos.png',
    'tempo-png': '/optimized/tempo.png',
    'upload-png': '/optimized/upload.png',
    'atencao-png': '/optimized/atenção.jpg',

    // Logo
    logo: '/optimized/Justo_logo.webp',
    'logo-full': '/optimized/logo+nome.webp',
} as const;

export type CustomIconName = keyof typeof ICON_PATHS;

interface CustomIconProps {
    name: CustomIconName;
    size?: number | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    alt?: string;
}

const SIZE_MAP = {
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
};

/**
 * CustomIcon - Premium icon component for JustoAI
 * Uses custom SVG/PNG icons from /public/icons and /public/optimized
 */
export function CustomIcon({
    name,
    size = 'md',
    className,
    alt,
}: CustomIconProps) {
    const iconPath = ICON_PATHS[name];
    const numericSize = typeof size === 'number' ? size : SIZE_MAP[size];

    if (!iconPath) {
        console.warn(`CustomIcon: Unknown icon name "${name}"`);
        return null;
    }

    return (
        <Image
            src={iconPath}
            alt={alt || name}
            width={numericSize}
            height={numericSize}
            className={cn('inline-block', className)}
            // SVGs can be colored via CSS filter, PNGs cannot
            style={{
                objectFit: 'contain',
            }}
        />
    );
}

/**
 * Inline SVG Icon component for icons that need to inherit currentColor
 * This fetches and inlines the SVG for full CSS control
 */
interface InlineSvgIconProps {
    name: 'cliente' | 'documentos' | 'ia' | 'calendario' | 'creditos' | 'tempo' | 'upload' | 'atencao';
    size?: number | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export function InlineSvgIcon({ name, size = 'md', className }: InlineSvgIconProps) {
    const numericSize = typeof size === 'number' ? size : SIZE_MAP[size];

    // Map icon names to inline SVG paths
    const svgContent: Record<string, React.ReactNode> = {
        cliente: (
            <svg width={numericSize} height={numericSize} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <circle cx="32" cy="18" r="8" stroke="currentColor" strokeWidth="2.5" fill="none" />
                <path d="M20 32C20 26 25 22 32 22C39 22 44 26 44 32V48C44 50.2 42.2 52 40 52H24C21.8 52 20 50.2 20 48V32Z"
                    stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
                <circle cx="50" cy="46" r="6" fill="currentColor" />
                <g stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="50" y1="43" x2="50" y2="49" />
                    <line x1="47" y1="46" x2="53" y2="46" />
                </g>
            </svg>
        ),
        documentos: (
            <svg width={numericSize} height={numericSize} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <path d="M14 28C14 25.8 15.8 24 18 24H40C42.2 24 44 25.8 44 28V52C44 54.2 42.2 56 40 56H18C15.8 56 14 54.2 14 52V28Z"
                    stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round" opacity="0.5" />
                <path d="M22 12C22 9.8 23.8 8 26 8H48C50.2 8 52 9.8 52 12V36C52 38.2 50.2 40 48 40H26C23.8 40 22 38.2 22 36V12Z"
                    stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
                <path d="M48 8L44 12H48V8Z" stroke="currentColor" strokeWidth="2" fill="none" />
                <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
                    <line x1="28" y1="18" x2="46" y2="18" />
                    <line x1="28" y1="24" x2="46" y2="24" />
                    <line x1="28" y1="30" x2="46" y2="30" />
                </g>
            </svg>
        ),
        ia: (
            <svg width={numericSize} height={numericSize} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <path d="M24 30C22 30 20 32 20 35C20 38 21 40 22 42C22.5 44 24 46 26 46C28 46 29.5 44 30 42C31 39 31 34 31 31C31 29.5 29.5 30 28 30H24Z"
                    stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M40 30C42 30 44 32 44 35C44 38 43 40 42 42C41.5 44 40 46 38 46C36 46 34.5 44 34 42C33 39 33 34 33 31C33 29.5 34.5 30 36 30H40Z"
                    stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M32 30V46" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="32" y1="10" x2="32" y2="16" />
                    <line x1="19" y1="17" x2="23" y2="21" />
                    <line x1="45" y1="17" x2="41" y2="21" />
                    <line x1="14" y1="38" x2="20" y2="38" />
                    <line x1="50" y1="38" x2="44" y2="38" />
                    <line x1="32" y1="54" x2="32" y2="48" />
                </g>
            </svg>
        ),
        calendario: (
            <svg width={numericSize} height={numericSize} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <rect x="10" y="14" width="44" height="40" rx="4" stroke="currentColor" strokeWidth="2.5" fill="none" />
                <line x1="10" y1="26" x2="54" y2="26" stroke="currentColor" strokeWidth="2" />
                <line x1="22" y1="8" x2="22" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="42" y1="8" x2="42" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <g fill="currentColor">
                    <rect x="18" y="32" width="8" height="6" rx="1" />
                    <rect x="28" y="32" width="8" height="6" rx="1" />
                    <rect x="38" y="32" width="8" height="6" rx="1" />
                    <rect x="18" y="42" width="8" height="6" rx="1" />
                    <rect x="28" y="42" width="8" height="6" rx="1" />
                </g>
            </svg>
        ),
        creditos: (
            <svg width={numericSize} height={numericSize} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="2.5" fill="none" />
                <path d="M32 18V46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M38 24C38 24 36 22 32 22C28 22 25 24.5 25 28C25 31.5 28 33 32 34C36 35 39 36.5 39 40C39 44 35 46 32 46C28 46 26 44 26 44"
                    stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </svg>
        ),
        tempo: (
            <svg width={numericSize} height={numericSize} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="2.5" fill="none" />
                <path d="M32 18V32L42 38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="32" cy="32" r="3" fill="currentColor" />
            </svg>
        ),
        upload: (
            <svg width={numericSize} height={numericSize} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <path d="M32 42V18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M24 26L32 18L40 26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 40V48C12 50.2 13.8 52 16 52H48C50.2 52 52 50.2 52 48V40"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </svg>
        ),
        atencao: (
            <svg width={numericSize} height={numericSize} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <path d="M32 8L56 52H8L32 8Z" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
                <line x1="32" y1="24" x2="32" y2="38" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <circle cx="32" cy="46" r="2.5" fill="currentColor" />
            </svg>
        ),
    };

    return svgContent[name] || null;
}

// Export icon names for autocomplete
export const CUSTOM_ICON_NAMES = Object.keys(ICON_PATHS) as CustomIconName[];
