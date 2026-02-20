import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { ControlBarButton } from './ControlBarButton';
import { useControlBarContext } from './ControlBarContext';

/**
 * PDF 업로드 버튼
 */
export const PdfUploadButton: React.FC = () => {
  const { t } = useTranslation();
  const { compact } = useControlBarContext();
  const isPdfUploadOpen = usePanelStore((state) => state.isPdfUploadOpen);
  const togglePdfUpload = usePanelStore((state) => state.togglePdfUpload);

  const icon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  return (
    <ControlBarButton
      icon={icon}
      label={t('controlBar.upload', 'Upload')}
      onClick={togglePdfUpload}
      isActive={isPdfUploadOpen}
      tooltip={t('controlBar.uploadTip', 'Upload document')}
      compact={compact}
    />
  );
};

export default PdfUploadButton;
