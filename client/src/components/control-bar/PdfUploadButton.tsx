// PdfUploadButton 컴포넌트
import React from 'react';
import { usePanelStore } from '../../stores/panel-store';

const IcoUpload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
  </svg>
);

interface CtrlBtnProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function CtrlBtn({ icon, label, active, onClick }: CtrlBtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, minWidth: 56, padding: '6px 8px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        borderRadius: 8, transition: 'background 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'}
      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
    >
      <div style={{ color: active ? '#60a5fa' : 'rgba(255,255,255,0.85)', fontSize: '1.2rem', lineHeight: 1 }}>
        {icon}
      </div>
      <span style={{
        fontSize: '0.62rem', fontWeight: 500,
        color: active ? '#60a5fa' : 'rgba(255,255,255,0.6)',
        letterSpacing: '-0.01em', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </button>
  );
}

export default function PdfUploadButton() {
  const isPdfUploadOpen = usePanelStore(s => s.isPdfUploadOpen);
  const togglePdfUpload = usePanelStore(s => s.togglePdfUpload);

  return (
    <CtrlBtn
      icon={<IcoUpload />}
      label="PDF 업로드"
      active={isPdfUploadOpen}
      onClick={togglePdfUpload}
    />
  );
}
