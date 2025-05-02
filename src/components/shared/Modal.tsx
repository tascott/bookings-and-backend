'use client';

import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  // Simple styling - replace with your preferred styling solution (CSS Modules, styled-components, etc.)
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Ensure modal is on top
  };

  const modalStyle: React.CSSProperties = {
    background: '#2a2a2e', // Dark background consistent with profile edit
    color: '#fff', // Light text
    padding: '20px',
    borderRadius: '8px',
    minWidth: '300px',
    maxWidth: '80%',
    maxHeight: '80vh',
    overflowY: 'auto',
    position: 'relative',
  };

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    background: 'transparent',
    border: 'none',
    fontSize: '1.5rem',
    color: '#ccc',
    cursor: 'pointer',
  };

  return (
    <div style={backdropStyle} onClick={onClose}> {/* Close on backdrop click */}
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}> {/* Prevent closing when clicking inside modal */}
        <button style={closeButtonStyle} onClick={onClose}>&times;</button>
        {title && <h2 style={{ marginTop: 0, marginBottom: '15px' }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
};

export default Modal;