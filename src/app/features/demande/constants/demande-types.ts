export interface DemandeTypeOption {
  value: string;
  label: string;
}

export const DEMANDE_TYPE_OPTIONS: DemandeTypeOption[] = [
  { value: 'PARAMETRABLE', label: 'Paramétrage' },
  { value: 'EVOLUTION', label: 'Évolution' },
];

