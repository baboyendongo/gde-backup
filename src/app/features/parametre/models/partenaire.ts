export interface Partenaire {
  id: number;
  nom: string;
  type?: string;
  emailContact: string;
  webhookUrl?: string;
  actif: boolean;
  /** IDs des applications (équipes SI) associées */
  applicationId: number[];
  
}

export interface CreatePartenaireRequest {
  nom: string;
  type?: string;
  emailContact: string;
  webhookUrl?: string;
  actif: boolean;
  /** IDs des applications (équipes SI) associées */
  applicationId: number[];
}