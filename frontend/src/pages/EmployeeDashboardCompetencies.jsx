import React from "react";

export default function CompetenciesSection({ competencies = [], onOpen }) {
  // Render a grid of competencies
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
      {competencies.length === 0 && (
        <div style={{ color: '#888', fontSize: 18, textAlign: 'center', gridColumn: '1/-1' }}>No competencies assigned.</div>
      )}
      {competencies.map((comp, idx) => {
        const hasId = comp && comp.id !== undefined && comp.id !== null;
        return (
          <div
            key={hasId ? comp.id : `comp-${idx}`}
            style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
              padding: 24,
              cursor: hasId ? 'pointer' : 'not-allowed',
              border: '1.5px solid #e3eafc',
              transition: 'box-shadow 0.18s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              minHeight: 120,
              opacity: hasId ? 1 : 0.5,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}
            onClick={() => hasId && onOpen && onOpen(comp)}
            title={hasId ? '' : 'Missing competency ID'}
          >
            <div style={{ fontWeight: 700, fontSize: 18, color: '#1976d2', marginBottom: 6, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{comp.title}</div>
            <div style={{ color: '#444', fontSize: 15, marginBottom: 8, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{comp.description || 'No description'}</div>
            <div style={{ color: '#888', fontSize: 13, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>Ref: {comp.reference_number || 'N/A'}</div>
            {!hasId && <div style={{ color: '#c62828', fontSize: 13, marginTop: 8 }}>Missing ID</div>}
          </div>
        );
      })}
    </div>
  );
}
