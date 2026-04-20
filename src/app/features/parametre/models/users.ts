
export enum UserStatus {
    ACTIVE = 'Actif',
    INACTIVE = 'Desactif',
}

export interface User {
    id: number;
    username: string;  // Cette propriété est nécessaire
    cn?: string;
    email?: string;                  // Rôle principal (compatibilité)
    roles?: string[];                 // ✨ NOUVEAU : Liste de tous les rôles
    permissions: string[];      // Toutes les permissions actives
    customPermissions?: string[];
    equipes?: string[];               // Équipes SI (ex. SI_ERP, SI_SAGE)
    status: UserStatus;
}