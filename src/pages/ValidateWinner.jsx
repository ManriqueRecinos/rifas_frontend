import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './ValidateWinner.css';

export default function ValidateWinner() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const [activeTab, setActiveTab] = useState('code'); // 'code' or 'pdf'
  const [dragActive, setDragActive] = useState(false);

  const handleSubmitCode = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const response = await api.post('/raffles/validate-winner', { code: code.trim() });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo validar el ganador');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Por favor, sube un archivo PDF válido.');
      return;
    }
    
    setError('');
    setResult(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('ticket_pdf', file);

    try {
      const response = await api.post('/raffles/validate-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo validar el PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="winner-validate-page">
      <Link to="/dashboard" className="winner-validate-back">
        ← Volver al panel
      </Link>
      <div className="winner-validate-card">
        <div className="winner-validate-header">
          <span className="winner-validate-icon">🏆</span>
          <h1>Validar ganador</h1>
          <p>Ingresa el código que te compartió el supuesto ganador.</p>
        </div>

        {!result && (
          <div className="winner-validate-tabs-container">
            <div className="winner-validate-tabs">
              <button 
                className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
                onClick={() => setActiveTab('code')}
              >
                Ingresar Código
              </button>
              <button 
                className={`tab-btn ${activeTab === 'pdf' ? 'active' : ''}`}
                onClick={() => setActiveTab('pdf')}
              >
                Subir PDF Mágico
              </button>
            </div>

            {activeTab === 'code' && (
              <form className="winner-validate-form" onSubmit={handleSubmitCode}>
                <label>Código del ticket ganador
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Pega aquí el código de validación"
                    required
                  />
                </label>

                {error && <div className="winner-validate-error">{error}</div>}

                <button type="submit" className="winner-validate-btn" disabled={loading || !code.trim()}>
                  {loading ? 'Validando...' : 'Validar ganador'}
                </button>
              </form>
            )}

            {activeTab === 'pdf' && (
              <div className="winner-validate-pdf-section">
                <p style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '16px' }}>
                  Sube el PDF original del ticket. El sistema extraerá el código y lo validará automáticamente.
                </p>
                
                <div 
                  className={`drag-drop-zone ${dragActive ? 'active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="drag-icon">📄</div>
                  <p>Arrastra y suelta el PDF aquí</p>
                  <span>o</span>
                  <label className="file-upload-btn" htmlFor="pdf-upload">
                    Seleccionar Archivo
                  </label>
                  <input 
                    type="file" 
                    id="pdf-upload" 
                    accept=".pdf" 
                    onChange={(e) => handleFileUpload(e.target.files[0])} 
                    style={{ display: 'none' }}
                  />
                </div>

                {loading && <div className="pdf-loading">Leyendo y validando el PDF...</div>}
                {error && <div className="winner-validate-error">{error}</div>}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="winner-validate-result">
            <div className="winner-validate-ok">✓ Ticket canjeado</div>
            <h2>El ticket sí era ganador</h2>
            <div className="winner-validate-grid">
              <div><span>Rifa</span><strong>{result.ticket.raffle_title}</strong></div>
              <div><span>Ticket</span><strong>#{result.ticket.ticket_number}</strong></div>
              <div><span>Ganador</span><strong>{result.ticket.buyer_name || 'N/A'}</strong></div>
              <div><span>Organizador</span><strong>{result.ticket.organizer_name || 'N/A'}</strong></div>
              <div><span>Teléfono</span><strong>{result.ticket.organizer_phone || 'No disponible'}</strong></div>
            </div>
            <p className="winner-validate-note">
              El correo de confirmación fue enviado al ganador y el ticket quedó marcado como canjeado.
            </p>
            <Link to="/dashboard" className="winner-validate-btn secondary">Volver al panel</Link>
          </div>
        )}
      </div>
    </div>
  );
}