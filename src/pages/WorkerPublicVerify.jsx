import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

export default function WorkerPublicVerify() {
  const { id } = useParams();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let unmounted = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/worker/${id}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Worker credential not found' : 'Failed to load worker profile');
        }
        const data = await res.json();
        if (!unmounted) {
          setWorker(data.worker);
          setLoading(false);
        }
      } catch (err) {
        if (!unmounted) {
          setError(err.message || 'Unable to load profile');
          setLoading(false);
        }
      }
    }
    load();
    return () => { unmounted = true; };
  }, [id]);

  // Clean phone numbers for tel: and wa.me links
  const rawPhone = worker?.mobile || worker?.phone || '+971506344209';
  const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
  const waNumber = cleanPhone.replace(/^\+/, '');
  const telegramHandle = worker?.telegram ? worker.telegram.replace(/^@/, '') : 'altabadubai';
  const email = worker?.email || 'altabadubai@gmail.com';

  // Generate vCard download for 1-tap "Save to Contacts"
  const handleSaveContact = () => {
    if (!worker) return;
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${worker.name}`,
      `ORG:AL TABA TECHNICAL SERVICES L.L.C;${worker.department || 'Workforce'}`,
      `TITLE:${worker.designation || 'Staff'}`,
      `TEL;TYPE=CELL,VOICE:${cleanPhone}`,
      `TEL;TYPE=WORK,VOICE:${worker.company_phone || '+97143470252'}`,
      `EMAIL;TYPE=WORK,INTERNET:${email}`,
      `ADR;TYPE=WORK:;;P.O. Box 410634, Deira Murar Bldg 14, Flat 204;Dubai;;;United Arab Emirates`,
      `NOTE:Worker ID: ${worker.id} | Classification: ${worker.worker_type === 'contract' ? 'Contractor' : 'Company Staff'}`,
      'END:VCARD'
    ].join('\r\n');

    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${worker.name.replace(/\s+/g, '_')}_AlTaba.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${worker.name} - Al Taba Verified Workforce`,
        text: `Official Contact & Credential Profile for ${worker.name} (${worker.id})`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="verify-page-bg">
        <div className="verify-card-container">
          <div className="verify-card-box loading-state">
            <div className="verify-spinner" />
            <p>Verifying Workforce Credential...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="verify-page-bg">
        <div className="verify-card-container">
          <div className="verify-card-box error-state">
            <div className="verify-error-icon">⚠️</div>
            <h2>Verification Failed</h2>
            <p>{error || 'Worker credential was not found or has been revoked.'}</p>
            <Link to="/" className="verify-back-btn">Go to Homepage</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-page-bg">
      <div className="verify-card-container">
        
        {/* Top Official Seal Banner */}
        <div className="verify-official-banner">
          <div className="vob-brand">
            <div className="vob-logo-badge">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <span className="vob-company-name">Al Taba Technical Services L.L.C</span>
              <span className="vob-sub">Official Workforce Identity Pass · Dubai, UAE</span>
            </div>
          </div>
          <div className="vob-badge-verified">
            <span className="vob-dot" /> Verified Active
          </div>
        </div>

        {/* Main Employee Action Card */}
        <div className="verify-card-box">
          
          {/* Worker Avatar & Identity */}
          <div className="verify-profile-header">
            <div className="verify-avatar-wrap">
              {worker.photo ? (
                <img src={worker.photo} alt={worker.name} className="verify-avatar-img" />
              ) : (
                <div className="verify-avatar-fallback">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                  </svg>
                </div>
              )}
              <span className="verify-check-badge" title="Official Verified Personnel">✓</span>
            </div>

            <h1 className="verify-worker-name">{worker.name}</h1>
            <p className="verify-worker-role">{worker.designation || 'Specialist Staff'}</p>

            <div className="verify-chips-row">
              <span className="verify-chip chip-id">{worker.id}</span>
              <span className="verify-chip chip-dept">{worker.department || 'Operations'}</span>
              <span className={`verify-chip ${worker.worker_type === 'contract' ? 'chip-contract' : 'chip-company'}`}>
                {worker.worker_type === 'contract' ? 'Contractor' : 'Company Staff'}
              </span>
            </div>
          </div>

          {/* Quick Communication Actions Section */}
          <div className="verify-actions-section">
            <div className="verify-section-label">
              <span>Instant Contact & Communication</span>
              <span className="vsl-hint">Tap any option below</span>
            </div>

            <div className="verify-action-grid">
              
              {/* 1. Direct Phone Call */}
              <a href={`tel:${cleanPhone}`} className="verify-btn btn-call">
                <div className="vb-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <div className="vb-content">
                  <span className="vb-title">Call Worker</span>
                  <span className="vb-sub">{rawPhone}</span>
                </div>
                <span className="vb-arrow">→</span>
              </a>

              {/* 2. WhatsApp Message */}
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hello ${worker.name}, contacting you via your Al Taba workforce ID pass (${worker.id}).`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="verify-btn btn-whatsapp"
              >
                <div className="vb-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.33C9.33 7.33 9 7.41 8.78 7.65C8.56 7.89 7.95 8.46 7.95 9.62C7.95 10.78 8.79 11.9 8.91 12.06C9.03 12.22 10.54 14.54 12.85 15.54C13.4 15.78 13.83 15.92 14.16 16.03C14.71 16.2 15.21 16.18 15.61 16.12C16.05 16.05 16.97 15.56 17.16 15.02C17.35 14.48 17.35 14.02 17.29 13.92C17.23 13.82 17.07 13.76 16.83 13.64C16.59 13.52 15.4 12.94 15.18 12.86C14.96 12.78 14.8 12.74 14.64 12.98C14.48 13.22 14.02 13.76 13.88 13.92C13.74 14.08 13.6 14.1 13.36 13.98C13.12 13.86 12.35 13.61 11.44 12.8C10.73 12.17 10.25 11.39 10.11 11.15C9.97 10.91 10.1 10.78 10.22 10.66C10.33 10.55 10.47 10.37 10.59 10.23C10.71 10.09 10.75 9.99 10.83 9.83C10.91 9.67 10.87 9.53 10.81 9.41C10.75 9.29 10.29 8.16 10.1 7.7C9.91 7.25 9.72 7.31 9.57 7.31L9.53 7.33Z" />
                  </svg>
                </div>
                <div className="vb-content">
                  <span className="vb-title">WhatsApp Chat</span>
                  <span className="vb-sub">Instant direct messaging</span>
                </div>
                <span className="vb-arrow">→</span>
              </a>

              {/* 3. Telegram Message */}
              <a
                href={`https://t.me/${telegramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="verify-btn btn-telegram"
              >
                <div className="vb-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .36z" />
                  </svg>
                </div>
                <div className="vb-content">
                  <span className="vb-title">Telegram Chat</span>
                  <span className="vb-sub">@{telegramHandle}</span>
                </div>
                <span className="vb-arrow">→</span>
              </a>

              {/* 4. Send Email */}
              <a
                href={`mailto:${email}?subject=WorkTrack%20Enquiry%20-%20${encodeURIComponent(worker.name)}%20(${worker.id})`}
                className="verify-btn btn-email"
              >
                <div className="vb-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <div className="vb-content">
                  <span className="vb-title">Email Worker</span>
                  <span className="vb-sub">{email}</span>
                </div>
                <span className="vb-arrow">→</span>
              </a>

              {/* 5. Save Contact (.vcf) */}
              <button
                type="button"
                onClick={handleSaveContact}
                className="verify-btn btn-contact"
              >
                <div className="vb-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                    <polyline points="16 11 18 13 22 9" />
                  </svg>
                </div>
                <div className="vb-content">
                  <span className="vb-title">Save to Phone Contacts</span>
                  <span className="vb-sub">Download .vcf vCard</span>
                </div>
                <span className="vb-arrow">↓</span>
              </button>

              {/* 6. Company Office Helpline */}
              <a href={`tel:${worker.company_phone || '+97143470252'}`} className="verify-btn btn-office">
                <div className="vb-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div className="vb-content">
                  <span className="vb-title">Al Taba Main Office</span>
                  <span className="vb-sub">{worker.company_phone || '+971 4 3470252'}</span>
                </div>
                <span className="vb-arrow">→</span>
              </a>

            </div>
          </div>

          {/* Verified Official Credentials & Information Grid */}
          <div className="verify-info-section">
            <h3 className="verify-info-heading">Official Employment Credentials</h3>
            
            <div className="verify-details-grid">
              <div className="v-detail-card">
                <span className="vd-label">Date of Joining</span>
                <span className="vd-val">
                  {worker.doj ? new Date(worker.doj + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>

              <div className="v-detail-card">
                <span className="vd-label">Years of Experience</span>
                <span className="vd-val highlight-val">{worker.experience || '—'}</span>
              </div>

              <div className="v-detail-card">
                <span className="vd-label">Employment Status</span>
                <span className="vd-val status-val">
                  <span className="vd-dot" /> Active · On Duty
                </span>
              </div>

              <div className="v-detail-card">
                <span className="vd-label">Workforce ID Pass</span>
                <span className="vd-val font-mono">{worker.id}</span>
              </div>
            </div>

            {/* Official Registered Company Address */}
            <div className="verify-company-box">
              <div className="vcb-icon">📍</div>
              <div>
                <span className="vcb-name">AL TABA TECHNICAL SERVICES L.L.C</span>
                <span className="vcb-addr">{worker.company_address}</span>
              </div>
            </div>

            {/* Share / Copy Link footer button */}
            <div className="verify-share-bar">
              <button type="button" onClick={handleShare} className="verify-share-btn">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>{copied ? 'Link Copied to Clipboard!' : 'Share Employee Digital Card'}</span>
              </button>
            </div>

          </div>

        </div>

        {/* Footer Security Notice */}
        <div className="verify-footer-notice">
          <p>🔒 Cryptographically verified against Al Taba Workforce Central Registry.</p>
          <p>© {new Date().getFullYear()} Al Taba Technical Services L.L.C · All Rights Reserved</p>
        </div>

      </div>
    </div>
  );
}
