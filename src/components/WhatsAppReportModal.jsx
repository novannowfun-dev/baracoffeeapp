import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Copy, Check, Send, Sparkles, RefreshCw } from 'lucide-react';
import { generateBaraWhatsAppReport } from '../lib/whatsappReport';
import { OUTLETS } from '../lib/outletContext';

export default function WhatsAppReportModal({ isOpen, onClose, record, activeOutlet }) {
  if (!isOpen || !record) return null;

  const [copied, setCopied] = useState(false);
  const outletObj = OUTLETS[activeOutlet?.toUpperCase()] || OUTLETS.KEDAI;

  const reportText = generateBaraWhatsAppReport({
    outletName: outletObj.name,
    dateStr: record.entry_date,
    shift: record.shift,
    cashier: record.cashier_name,
    omset: {
      cash: record.payment_cash,
      qris: record.payment_qris,
      edc: record.payment_edc,
      online: record.payment_delivery,
      transfer: record.payment_transfer,
      gross: record.gross_sales,
      discount: record.discounts,
      net: record.net_sales
    },
    cashDrawer: {
      opening: record.opening_cash,
      pettyCash: record.petty_cash_out,
      actual: record.actual_cash,
      diff: record.cash_difference
    },
    notes: record.notes
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(reportText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return createPortal(
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(15, 23, 42, 0.75)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2500,
      padding: "16px",
      boxSizing: "border-box"
    }}>
      <div className="animate-fade-in" style={{
        maxWidth: "540px",
        width: "100%",
        background: "#ffffff",
        color: "#0f172a",
        borderRadius: "16px",
        padding: "28px",
        boxShadow: "0 25px 70px -15px rgba(0, 0, 0, 0.35)",
        border: "1px solid #e2e8f0",
        position: "relative",
        maxHeight: "min(92vh, 650px)",
        overflowY: "auto",
        boxSizing: "border-box"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(37, 211, 102, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageCircle size={22} style={{ color: "#16a34a" }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>Format WhatsApp Rekap Omset</h3>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Siap dikirim ke grup Owner / Pengelola Kedai Kopi Bara</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", color: "#64748b", cursor: "pointer", padding: "6px 10px", borderRadius: "8px", fontWeight: 700, fontSize: "0.9rem" }}>✕</button>
        </div>

        <div style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "16px",
          fontFamily: "var(--font-mono), monospace",
          fontSize: "0.82rem",
          whiteSpace: "pre-wrap",
          maxHeight: "260px",
          overflowY: "auto",
          lineHeight: 1.6,
          color: "#1e293b",
          marginBottom: "20px"
        }}>
          {reportText}
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" onClick={handleCopy} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "9px", background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#334155", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
            {copied ? <Check size={16} style={{ color: "#16a34a" }} /> : <Copy size={16} />}
            <span>{copied ? "Tersalin ke Clipboard!" : "Salin Format Teks"}</span>
          </button>
          <button type="button" onClick={handleOpenWhatsApp} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 20px", borderRadius: "9px", background: "#16a34a", border: "none", color: "#ffffff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", boxShadow: "0 4px 14px rgba(22, 163, 74, 0.3)" }}>
            <Send size={16} /> Buka WhatsApp Sekarang
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}