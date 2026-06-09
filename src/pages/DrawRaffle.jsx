import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Wheel } from 'react-custom-roulette';
import './DrawRaffle.css';

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DrawRaffle() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [raffle, setRaffle] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  
  // Modes: 'quick' (Direct to winner) or 'gradual' (Elimination)
  const [drawMode, setDrawMode] = useState('quick');
  const [drawSize, setDrawSize] = useState(1);
  const [winnerCount, setWinnerCount] = useState(1);
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [winnerTicketIds, setWinnerTicketIds] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const spinResolverRef = useRef(null);

  const spinTo = async (ticketId, currentWheelTickets) => {
    const targetIndex = currentWheelTickets.findIndex((t) => t.id === ticketId);
    setPrizeNumber(targetIndex >= 0 ? targetIndex : 0);
    setMustSpin(true);
    return new Promise((resolve) => {
      spinResolverRef.current = resolve;
    });
  };

  const handleStopSpinning = () => {
    setMustSpin(false);
    if (spinResolverRef.current) {
      spinResolverRef.current();
      spinResolverRef.current = null;
    }
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get(`/raffles/${id}`),
      api.get(`/raffles/${id}/tickets`),
    ])
      .then(([raffleRes, ticketsRes]) => {
        if (!mounted) return;
        setRaffle(raffleRes.data);
        setTickets(ticketsRes.data || []);
        const persistedWinners = Array.isArray(raffleRes.data.winning_ticket_ids)
          ? raffleRes.data.winning_ticket_ids
          : raffleRes.data.winning_ticket_id
            ? [raffleRes.data.winning_ticket_id]
            : [];
        setWinnerTicketIds(persistedWinners);
      })
      .catch((err) => {
        if (mounted) setStatusMessage(err.response?.data?.error || 'No se pudo cargar la rifa');
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [id]);

  const raffleOwner = user && raffle && user.id === raffle.user_id;
  const remainingTickets = useMemo(
    () => tickets.filter((ticket) => !['eliminated', 'winner'].includes(ticket.status)),
    [tickets],
  );
  const eliminatedTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'eliminated'),
    [tickets],
  );
  const winnerTickets = useMemo(
    () => tickets.filter((ticket) => winnerTicketIds.includes(ticket.id) || ticket.status === 'winner'),
    [tickets, winnerTicketIds],
  );

  const primaryWinnerTicket = winnerTickets[0] || tickets.find((ticket) => ticket.status === 'winner') || null;

  const persistRound = async (eliminatedIds, currentWinnerIds = []) => {
    const response = await api.post(`/raffles/${id}/manual-draw`, {
      eliminated_ticket_ids: eliminatedIds,
      winner_ticket_ids: currentWinnerIds,
    });

    const [raffleRes, ticketsRes] = await Promise.all([
      api.get(`/raffles/${id}`),
      api.get(`/raffles/${id}/tickets`),
    ]);

    setRaffle(raffleRes.data);
    setTickets(ticketsRes.data || []);
    const persistedWinners = Array.isArray(raffleRes.data.winning_ticket_ids)
      ? raffleRes.data.winning_ticket_ids
      : raffleRes.data.winning_ticket_id
        ? [raffleRes.data.winning_ticket_id]
        : [];
    setWinnerTicketIds(response.data.winnerTicketIds || persistedWinners);
  };

  const runSpin = async () => {
    if (drawing || !raffleOwner) return;
    if (raffle?.status === 'completed' || winnerTicketIds.length) return;
    if (remainingTickets.length === 0) {
      setStatusMessage('No hay participantes disponibles.');
      return;
    }

    const normalizedWinnerCount = Math.max(1, Math.min(parseInt(winnerCount || '1', 10), remainingTickets.length));
    const currentWheelTickets = remainingTickets.length > 0 ? remainingTickets : tickets;
    const requestedDrawSize = drawMode === 'quick' ? 0 : Math.max(0, parseInt(drawSize || '0', 10));

    if (remainingTickets.length <= normalizedWinnerCount || requestedDrawSize === 0) {
      const finalWinners = shuffle(remainingTickets).slice(0, normalizedWinnerCount);
      setDrawing(true);
      setStatusMessage('Giro final para revelar los ganadores...');

      setActiveTicketId(finalWinners[0]?.id || null);
      if (finalWinners.length > 0) {
        await spinTo(finalWinners[0].id, currentWheelTickets);
      }

      try {
        const finalEliminated = remainingTickets.filter(t => !finalWinners.find(w => w.id === t.id));
        await persistRound([...selectedTicketIds, ...finalEliminated.map(t => t.id)], finalWinners.map((ticket) => ticket.id));
        setWinnerTicketIds(finalWinners.map((ticket) => ticket.id));
        setStatusMessage(`${finalWinners.length} ganador${finalWinners.length > 1 ? 'es' : ''} definido${finalWinners.length > 1 ? 's' : ''} y guardado${finalWinners.length > 1 ? 's' : ''}.`);
      } catch (err) {
        setStatusMessage(err.response?.data?.error || 'No se pudieron guardar los ganadores.');
      } finally {
        setDrawing(false);
      }
      return;
    }

    // Modalidad de eliminación uno por uno
    const maxEliminations = Math.max(0, remainingTickets.length - normalizedWinnerCount);
    const roundSize = Math.min(requestedDrawSize, maxEliminations);
    const roundTickets = shuffle(remainingTickets);
    
    setDrawing(true);
    setStatusMessage(`Iniciando ronda de ${roundSize} eliminación(es)...`);
    
    let currentSelectedEliminatedIds = [...selectedTicketIds];
    let newlyEliminated = [];

    try {
      for (let i = 0; i < roundSize; i++) {
        const ticketToEliminate = roundTickets[i];
        setStatusMessage(`Girando la ruleta para eliminar (${i + 1}/${roundSize})...`);
        
        setActiveTicketId(ticketToEliminate.id);
        await spinTo(ticketToEliminate.id, currentWheelTickets);
        await sleep(600);
        
        currentSelectedEliminatedIds.push(ticketToEliminate.id);
        newlyEliminated.push(ticketToEliminate);
        setSelectedTicketIds([...currentSelectedEliminatedIds]);
        
        if (i < roundSize - 1) {
           await sleep(800); 
        }
      }

      setStatusMessage('Guardando resultados de la ronda...');
      await persistRound(newlyEliminated.map((ticket) => ticket.id));
      setStatusMessage(`${newlyEliminated.length} participante${newlyEliminated.length > 1 ? 's' : ''} eliminado${newlyEliminated.length > 1 ? 's' : ''}.`);
      
      const newRemainingCount = remainingTickets.length - newlyEliminated.length;
      if (newRemainingCount <= normalizedWinnerCount) {
         setStatusMessage('Descalificados terminados. El siguiente giro será para los ganadores.');
      }
      
    } catch (err) {
      setStatusMessage(err.response?.data?.error || 'No se pudo guardar el sorteo.');
    } finally {
      setActiveTicketId(null);
      setDrawing(false);
    }
  };

  if (loading) {
    return <div className="draw-page container"><div className="draw-loading">Cargando sorteo...</div></div>;
  }

  if (!raffle) {
    return <div className="draw-page container"><div className="draw-loading">Rifa no encontrada.</div></div>;
  }

  const wheelTickets = remainingTickets.length > 0 ? remainingTickets : tickets;

  const rouletteData = wheelTickets.length > 1 ? wheelTickets.map((t) => {
    const isEliminated = selectedTicketIds.includes(t.id) || t.status === 'eliminated';
    const nameStr = t.buyer_name ? t.buyer_name.split(' ')[0] : 'Anónimo';
    const label = `#${t.ticket_number} - ${nameStr.substring(0,10)}`;
    return {
      option: label,
      style: {
        backgroundColor: isEliminated ? '#ef4444' : '#0f3460',
        textColor: isEliminated ? '#fff' : '#fff'
      }
    };
  }) : (wheelTickets.length === 1 ? [
    { option: `#${wheelTickets[0].ticket_number}`, style: { backgroundColor: '#0f3460', textColor: '#fff' } },
    { option: `Ganador`, style: { backgroundColor: '#4ade80', textColor: '#111' } }
  ] : [
    { option: 'Vacío', style: { backgroundColor: '#ef4444', textColor: '#fff' } },
    { option: 'Vacío', style: { backgroundColor: '#ef4444', textColor: '#fff' } }
  ]);

  return (
    <div className="draw-page container">
      <div className="draw-header">
        <div>
          <Link to={`/raffle/${id}`} className="draw-back">← Volver a la rifa</Link>
          <h1 className="draw-title">Sorteo Manual</h1>
          <p className="draw-sub">{raffle.title}</p>
        </div>
        <div className="draw-badges">
          <span className={`draw-badge ${raffle.status}`}>{raffle.status}</span>
          <span className="draw-badge">Restan {remainingTickets.length}</span>
        </div>
      </div>

      <div className="draw-layout">
        <section className="draw-wheel-panel">
          {primaryWinnerTicket && (
            <div className="winner-banner">
              <h3>🎉 ¡Gran Ganador! 🎉</h3>
              <strong>#{primaryWinnerTicket.ticket_number}</strong>
              <p>{primaryWinnerTicket.buyer_name || 'Desconocido'}</p>
            </div>
          )}

          <div className="draw-wheel-wrap">
            <div className="draw-wheel-container">
              <Wheel
                mustStartSpinning={mustSpin}
                prizeNumber={prizeNumber}
                data={rouletteData}
                onStopSpinning={handleStopSpinning}
                backgroundColors={['#0f3460', '#1a1a2e']}
                textColors={['#ffffff']}
                outerBorderColor="#e8c840"
                outerBorderWidth={4}
                innerBorderColor="#e8c840"
                innerBorderWidth={2}
                innerRadius={15}
                radiusLineColor="#e8c840"
                radiusLineWidth={1}
                fontSize={16}
                spinDuration={0.4}
              />
            </div>
            <div className="draw-center-card">
              {winnerTickets.length > 0 ? (
                <>
                  <span className="draw-center-label">Ganadores</span>
                  <strong>{winnerTickets.length}</strong>
                  <small>ticket{winnerTickets.length > 1 ? 's' : ''} seleccionado{winnerTickets.length > 1 ? 's' : ''}</small>
                </>
              ) : activeTicketId ? (
                <>
                  <span className="draw-center-label">Ruleta girando</span>
                  <strong>
                    {tickets.find((ticket) => ticket.id === activeTicketId)?.buyer_name || 'Participante'}
                  </strong>
                </>
              ) : (
                <>
                  <span className="draw-center-label">Listo para sortear</span>
                  <strong>{raffle.title}</strong>
                </>
              )}
            </div>
          </div>
        </section>

        <aside className="draw-side">
          <div className="draw-card">
            <h3 style={{ marginBottom: '16px', color: 'var(--text)' }}>Modo de Sorteo</h3>
            
            <div className="draw-modes" style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg2)', padding: '6px', borderRadius: '12px' }}>
              <button 
                className={`tab-btn ${drawMode === 'quick' ? 'active' : ''}`}
                onClick={() => setDrawMode('quick')}
                disabled={drawing || raffle.status === 'completed'}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: drawMode === 'quick' ? 'var(--bg3)' : 'transparent', color: drawMode === 'quick' ? 'var(--text)' : 'var(--text3)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                ⚡ Rápido
              </button>
              <button 
                className={`tab-btn ${drawMode === 'gradual' ? 'active' : ''}`}
                onClick={() => setDrawMode('gradual')}
                disabled={drawing || raffle.status === 'completed'}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: drawMode === 'gradual' ? 'var(--bg3)' : 'transparent', color: drawMode === 'gradual' ? 'var(--text)' : 'var(--text3)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                ⏳ Eliminación
              </button>
            </div>

            {drawMode === 'quick' && (
              <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px', lineHeight: '1.4' }}>
                <strong>Sorteo Rápido:</strong> La ruleta girará y seleccionará automáticamente a los ganadores, eliminando al resto. Ideal para terminar rápido.
              </p>
            )}

            {drawMode === 'gradual' && (
              <>
                <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px', lineHeight: '1.4' }}>
                  <strong>Sorteo por Eliminación:</strong> La ruleta irá descartando participantes poco a poco en cada giro, generando suspenso antes del ganador.
                </p>
                <label>Cantidad de descalificados por giro</label>
                <input
                  type="number"
                  min="0"
                  max={Math.max(0, remainingTickets.length - Math.max(1, parseInt(winnerCount || '1', 10)))}
                  value={drawSize}
                  onChange={(e) => setDrawSize(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  disabled={drawing || raffle.status === 'completed'}
                />
              </>
            )}

            <label>Cantidad de ganadores finales</label>
            <input
              type="number"
              min="1"
              max={Math.max(1, tickets.length)}
              value={winnerCount}
              onChange={(e) => {
                const nextValue = parseInt(e.target.value || '1', 10);
                setWinnerCount(Number.isNaN(nextValue) ? 1 : Math.max(1, nextValue));
              }}
              disabled={drawing || raffle.status === 'completed'}
            />
            <button
              type="button"
              className="draw-btn"
              onClick={runSpin}
              disabled={drawing || raffle.status === 'completed' || remainingTickets.length === 0}
            >
              {drawing ? 'Girando...' : remainingTickets.length === 0 ? 'Sin participantes' : 'Girar ruleta'}
            </button>
            {statusMessage && <p className="draw-message">{statusMessage}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}