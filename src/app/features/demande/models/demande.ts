export interface Document {
  nomFichier: string;
  typeMime: string;
  taille: number;
  chemin: string;
  url?: string;
  datecreate: string;
  userinput: string;
}

export interface HistoriqueItem {
  id: number;
  ancienstatut: { id: number; code: string; libelle: string } | null;
  nouveaustatut: { id: number; code: string; libelle: string };
  datecreate: string;
  userinput: string;
  commentaire: string;
}

export interface Demande {
  id: number;
  objet: string;
  description: string;
  application: string;
  datecreate: string;
  niveaupriorite: string;
  statut: string;
  documents: Document[];
  commentaires: any[];
  historique?: HistoriqueItem[];
  departement: string;
  typeDemande: string;
  assignedTo?: string;
  createdBy?: string;
}
