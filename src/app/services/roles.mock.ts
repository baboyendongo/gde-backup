export enum RoleKey {
  ADMIN_SI = 'ADMIN_SI',
  METIER = 'METIER',
  AGENT_SI = 'AGENT_SI',
  PARTENAIRE = 'PARTENAIRE'
}

export interface Role {
  id: number;
  key: RoleKey;
  displayName: string;
  description?: string;
  permissions?: string[];
}

export const MOCK_ROLES: Role[] = [
  {
    id: 1,
    key: RoleKey.ADMIN_SI,
    displayName: 'Admin SI',
    description: "Administrateur du système d'information",
    permissions: ['manage_users', 'view_reports', 'configure_system']
  },
  {
    id: 2,
    key: RoleKey.METIER,
    displayName: 'Métier',
    description: 'Utilisateur métier',
    permissions: ['create_demande', 'view_demande', 'edit_demande']
  },
  {
    id: 3,
    key: RoleKey.AGENT_SI,
    displayName: 'Agent SI',
    description: 'Agent du service informatique',
    permissions: ['assign_ticket', 'resolve_ticket', 'view_logs']
  },
  {
    id: 4,
    key: RoleKey.PARTENAIRE,
    displayName: 'Partenaire',
    description: 'Utilisateur externe / partenaire',
    permissions: ['submit_request', 'view_status']
  }
];

export function getRoleByKey(key: RoleKey): Role | undefined {
  return MOCK_ROLES.find(r => r.key === key);
}

export function getAllRoles(): Role[] {
  return [...MOCK_ROLES];
}
