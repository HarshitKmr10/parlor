export interface ModalProps {
  isOpen: boolean;
  onRequestClose?: () => void;
}

export type PDFModalProps = {
  url: string;
  onClose: () => void;
};
