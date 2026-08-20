import { useEffect, useState } from "react";
import { CheckCircle2, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { apiFetch } from "../services/api";

export default function TwoFactorSetup({ required = false, onComplete }) {
  const [status, setStatus] = useState({ enabled: false, loading: true });
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStatus() {
    try {
      const data = await apiFetch("/auth/2fa/status");
      setStatus({ ...data, loading: false });
    } catch (err) {
      setStatus({ enabled: false, loading: false });
      setError(err?.message || "Failed to load two-factor status");
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function startSetup() {
    try {
      setBusy(true); setError(""); setMessage(""); setRecoveryCodes([]);
      setSetup(await apiFetch("/auth/2fa/setup", { method: "POST" }));
    } catch (err) {
      setError(err?.message || "Failed to start setup");
    } finally { setBusy(false); }
  }

  async function enableTwoFactor() {
    try {
      setBusy(true); setError("");
      const data = await apiFetch("/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setRecoveryCodes(data.recoveryCodes || []);
      setSetup(null); setCode("");
      setMessage("Two-factor authentication is now enabled.");
      await loadStatus();
    } catch (err) {
      setError(err?.message || "Invalid verification code");
    } finally { setBusy(false); }
  }

  async function disableTwoFactor() {
    const verificationCode = window.prompt("Enter your current Authenticator code to disable two-factor authentication:");
    if (!verificationCode) return;
    try {
      setBusy(true); setError(""); setMessage("");
      await apiFetch("/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ code: verificationCode }),
      });
      setMessage("Two-factor authentication has been disabled.");
      setRecoveryCodes([]);
      await loadStatus();
    } catch (err) {
      setError(err?.message || "Could not disable two-factor authentication");
    } finally { setBusy(false); }
  }

  async function copyText(value) {
    await navigator.clipboard?.writeText(value);
    setMessage("Copied.");
  }

  if (status.loading) return <div className="two-factor-box">Loading security settings...</div>;

  return (
    <section className="two-factor-box">
      <style>{twoFactorCss}</style>
      <div className="two-factor-heading">
        <div className="two-factor-icon"><ShieldCheck size={23} /></div>
        <div>
          <p>Account Security</p>
          <h3>Two-Step Verification</h3>
        </div>
        <span className={status.enabled ? "two-factor-state enabled" : "two-factor-state"}>
          {status.enabled ? "Enabled" : "Not enabled"}
        </span>
      </div>

      <p className="two-factor-description">
        Use Google Authenticator or Microsoft Authenticator to protect your account with a 6-digit code.
      </p>
      {message ? <div className="two-factor-message ok">{message}</div> : null}
      {error ? <div className="two-factor-message error">{error}</div> : null}

      {!status.enabled && !setup ? (
        <button type="button" className="two-factor-primary" onClick={startSetup} disabled={busy}>
          <KeyRound size={18} /> {busy ? "Preparing..." : "Set up Authenticator"}
        </button>
      ) : null}

      {setup ? (
        <div className="two-factor-setup">
          <div className="two-factor-steps">
            <strong>1. Open your Authenticator app and scan this QR code.</strong>
            <img src={setup.qrCodeDataUrl} alt="Authenticator QR code" />
            <span>Cannot scan? Enter this key manually:</span>
            <button type="button" className="manual-key" onClick={() => copyText(setup.manualKey)}>
              <code>{setup.manualKey}</code><Copy size={16} />
            </button>
            <strong>2. Enter the 6-digit code shown in the app.</strong>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
            <button type="button" className="two-factor-primary" onClick={enableTwoFactor} disabled={busy || code.length !== 6}>
              <CheckCircle2 size={18} /> {busy ? "Verifying..." : "Verify and enable"}
            </button>
          </div>
        </div>
      ) : null}

      {recoveryCodes.length ? (
        <div className="recovery-box">
          <strong>Save these recovery codes now</strong>
          <p>Each code works once if you lose access to your Authenticator app. They will not be shown again.</p>
          <div>{recoveryCodes.map((item) => <code key={item}>{item}</code>)}</div>
          <button type="button" onClick={() => copyText(recoveryCodes.join("\n"))}><Copy size={16} /> Copy all codes</button>
          {required && <button type="button" className="two-factor-primary" onClick={() => onComplete?.()}>
            <CheckCircle2 size={16} /> I saved the codes — continue
          </button>}
        </div>
      ) : null}

      {status.enabled && !required ? (
        <div className="two-factor-enabled-actions">
          <span>{status.recoveryCodesRemaining} recovery codes remaining</span>
          <button type="button" onClick={disableTwoFactor} disabled={busy}>Disable two-step verification</button>
        </div>
      ) : null}
      {status.enabled && required && !recoveryCodes.length ? (
        <button type="button" className="two-factor-primary" onClick={() => onComplete?.()}>
          <CheckCircle2 size={16} /> Continue to sign in
        </button>
      ) : null}
    </section>
  );
}

const twoFactorCss = `
.two-factor-box{background:rgba(255,255,255,.94);border:1px solid rgba(226,232,240,.9);border-radius:30px;padding:22px;box-shadow:0 22px 55px rgba(15,23,42,.08);color:#0f172a}
.two-factor-heading{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:13px}.two-factor-icon{width:52px;height:52px;border-radius:18px;display:grid;place-items:center;background:#eff6ff;color:#1d4ed8}.two-factor-heading p{margin:0;color:#2563eb;font-size:12px;font-weight:950;text-transform:uppercase}.two-factor-heading h3{margin:5px 0 0;font-size:21px}.two-factor-state{padding:7px 10px;border-radius:999px;background:#fef2f2;color:#b91c1c;font-size:12px;font-weight:850}.two-factor-state.enabled{background:#ecfdf5;color:#15803d}.two-factor-description{color:#64748b;line-height:1.65}.two-factor-primary{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#0f172a,#1d4ed8);font-weight:850}.two-factor-setup{margin-top:16px}.two-factor-steps{display:grid;gap:12px}.two-factor-steps img{width:min(240px,100%);margin:auto;border-radius:18px;background:#fff;padding:8px}.two-factor-steps input{text-align:center;font-size:24px;letter-spacing:8px;font-weight:900}.manual-key{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#eff6ff;color:#1e3a8a}.manual-key code{word-break:break-all}.two-factor-message{padding:11px 13px;border-radius:13px;margin:10px 0;font-weight:750}.two-factor-message.ok{background:#ecfdf5;color:#166534}.two-factor-message.error{background:#fef2f2;color:#991b1b}.recovery-box{margin-top:16px;padding:16px;border:1px solid #f59e0b;border-radius:18px;background:#fffbeb;color:#78350f}.recovery-box p{font-size:13px;line-height:1.55}.recovery-box>div{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.recovery-box code{background:#fff;padding:8px;border-radius:8px;text-align:center}.recovery-box button{display:flex;align-items:center;gap:7px}.two-factor-enabled-actions{display:grid;gap:12px;margin-top:15px}.two-factor-enabled-actions span{color:#64748b;font-size:13px}.two-factor-enabled-actions button{background:#fef2f2;color:#b91c1c}.dark .two-factor-box{background:#111a2d;color:#e8eefb;border-color:#293852}.dark .two-factor-description,.dark .two-factor-enabled-actions span{color:#9fb0cf}.dark .two-factor-icon,.dark .manual-key{background:#17243b;color:#bfdbfe}@media(max-width:520px){.two-factor-heading{grid-template-columns:48px 1fr}.two-factor-state{grid-column:1/-1;width:max-content}.recovery-box>div{grid-template-columns:1fr}}
`;
