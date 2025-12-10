import { Badge } from '@/components/ui/badge';

export const PLACEHOLDER_CLIENT_NAMES = ['Cliente a Definir', 'cliente_a_definir', 'CLIENTE_A_DEFINIR'];

export function isPlaceholderClient(name: string): boolean {
    return PLACEHOLDER_CLIENT_NAMES.includes(name) || name.toLowerCase().includes('a definir');
}

export function getClientDisplayName(name: string) {
    if (isPlaceholderClient(name)) {
        return 'Processos Pendentes';
        // faster visual cue: return '📥 Processos Pendentes';
    }
    return name;
}

export function getClientBadgeVariant(name: string): "default" | "secondary" | "destructive" | "outline" {
    if (isPlaceholderClient(name)) {
        return 'secondary'; // Orange/Amber style usually handled by className, but badge variant 'secondary' is close
    }
    return 'default';
}
