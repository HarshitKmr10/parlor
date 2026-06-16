import { ModalProps } from 'types/modalTypes';

export type TeamType = {
  id: string;
  name: string;
  description: string;
  logo: string;
};

export interface TeamModalProps extends ModalProps {
  onTeamChange?: () => void; // Callback to refresh teams after add/edit/delete
}
