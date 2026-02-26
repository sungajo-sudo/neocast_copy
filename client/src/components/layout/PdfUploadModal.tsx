// PdfUploadModal 컴포넌트
import React, { useState } from 'react';
import { usePanelStore } from '../../stores/panel-store';

export default function PdfUploadModal() {
  const togglePdfUpload = usePanelStore(s => s.togglePdfUpload);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(f => f.type === 'application/pdf');

    if (pdfFiles.length > 0) {
      console.log('PDF 파일 업로드:', pdfFiles);
      // TODO: PDF 파일 처리 로직
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      console.log('PDF 파일 선택:', files[0]);
      // TODO: PDF 파일 처리 로직
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={togglePdfUpload}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 32,
          maxWidth: 500,
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 16, color: '#1e293b' }}>
          PDF 업로드
        </h2>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? '#6366f1' : '#cbd5e1'}`,
            borderRadius: 12,
            padding: 48,
            textAlign: 'center',
            background: isDragging ? 'rgba(99,102,241,0.05)' : 'rgba(241,245,249,0.5)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📄</div>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', marginBottom: 8 }}>
            PDF 파일을 드래그하여 업로드
          </p>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: 16 }}>
            또는 클릭하여 파일 선택
          </p>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileInput}
            style={{ display: 'none' }}
            id="pdf-upload-input"
          />
          <label
            htmlFor="pdf-upload-input"
            style={{
              display: 'inline-block',
              padding: '8px 20px',
              background: '#6366f1',
              color: 'white',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            파일 선택
          </label>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={togglePdfUpload}
            style={{
              padding: '8px 20px',
              background: '#e2e8f0',
              color: '#475569',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
