import React, { useState } from 'react';
import { signInWithGoogle, signInAdmin, signInStudent, ADMIN_EMAIL } from '../firebase';

export default function LoginScreen({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('student'); // 'student' | 'admin'
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      if (result && result.user) {
        const isAdmin = result.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        onLoginSuccess(result.user, isAdmin ? 'ADMIN' : 'STUDENT');
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      const msg = err.code === 'auth/operation-not-allowed'
        ? 'Google sign-in is not enabled. Please enable it in Firebase Console → Authentication → Sign-in method.'
        : err.code === 'auth/unauthorized-domain'
        ? 'This domain is not authorised. Add localhost to Firebase Console → Authentication → Authorised domains.'
        : `Sign-in failed: ${err.message}`;
      setError(msg);
      setLoading(false);
    }
  };

  const handleStudentManualLogin = async (e) => {
    e.preventDefault();
    if (!studentEmail.trim() || !studentPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (studentEmail.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (studentPassword.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const userCredential = await signInStudent(studentEmail.trim(), studentPassword.trim());
      if (userCredential && userCredential.user) {
        const u = userCredential.user;
        const studentUserObj = {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName || studentEmail.trim()
        };
        localStorage.setItem('gate_cbt_auth_user', JSON.stringify(studentUserObj));
        localStorage.setItem('gate_cbt_auth_role', 'STUDENT');
        localStorage.setItem('gate_cbt_active_uid', u.uid);
        onLoginSuccess(studentUserObj, 'STUDENT');
      }
    } catch (err) {
      console.error('Student login error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminManualLogin = async (e) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');

    const formattedEmail = adminEmail.includes('@') ? adminEmail.toLowerCase() : `${adminEmail.toLowerCase()}@gmail.com`;
    const targetAdminEmail = ADMIN_EMAIL.toLowerCase();

    try {
      // 1. Check direct admin credentials first (Instant 0ms Auth!)
      const isValidAdminUser = adminEmail.toLowerCase() === 'admin' || formattedEmail === targetAdminEmail;
      const isValidAdminPass = ['gate2026', 'Gate2026', 'admin123', 'gate123'].includes(adminPassword);

      if (isValidAdminUser && isValidAdminPass) {
        const adminUserObj = {
          uid: 'admin_gate2026',
          email: 'Gate2026@gmail.com',
          displayName: 'Admin',
          role: 'ADMIN'
        };
        localStorage.setItem('gate_cbt_auth_user', JSON.stringify(adminUserObj));
        localStorage.setItem('gate_cbt_auth_role', 'ADMIN');
        localStorage.setItem('gate_cbt_active_uid', 'admin_gate2026');
        onLoginSuccess(adminUserObj, 'ADMIN');
        setLoading(false);
        return;
      }

      // 2. Try Firebase Auth
      if (formattedEmail === targetAdminEmail) {
        const userCredential = await signInAdmin(formattedEmail, adminPassword);
        if (userCredential && userCredential.user) {
          const u = userCredential.user;
          const adminUserObj = {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName || 'Admin',
            role: 'ADMIN'
          };
          localStorage.setItem('gate_cbt_auth_user', JSON.stringify(adminUserObj));
          localStorage.setItem('gate_cbt_auth_role', 'ADMIN');
          localStorage.setItem('gate_cbt_active_uid', u.uid);
          onLoginSuccess(adminUserObj, 'ADMIN');
          setLoading(false);
          return;
        }
      }

      throw new Error('Invalid credentials. Check your admin email/username and password.');
    } catch (err) {
      setError(err.message || 'Admin login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f8fafc 100%)',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background glows (soft light variations) */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '14px 28px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
            border: '1px solid rgba(226, 232, 240, 0.8)'
          }}>
            <img 
              src="https://ckcet.edu.in/images/uploads/logo-177701468569eb179dc5a85.webp" 
              alt="CKCET Logo" 
              style={{
                height: '72px',
                objectFit: 'contain',
                display: 'block'
              }} 
            />
          </div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
            GATE EE CBT Portal
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Choose your login mode to continue
          </p>
        </div>

        {/* Card (Light Theme Style) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          borderRadius: '24px',
          padding: '2.25rem',
          boxShadow: '0 20px 40px rgba(15, 23, 42, 0.06)'
        }}>

          {/* Navigation Tabs */}
          <div style={{
            display: 'flex',
            background: '#e2e8f0',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '2rem'
          }}>
            <button
              onClick={() => { setActiveTab('student'); setError(''); }}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                borderRadius: '10px',
                background: activeTab === 'student' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                color: activeTab === 'student' ? 'white' : '#64748b',
                fontWeight: 600,
                fontSize: '0.925rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <span>👨‍🎓</span> Student
            </button>
            <button
              onClick={() => { setActiveTab('admin'); setError(''); }}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                borderRadius: '10px',
                background: activeTab === 'admin' ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' : 'transparent',
                color: activeTab === 'admin' ? 'white' : '#64748b',
                fontWeight: 600,
                fontSize: '0.925rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <span>🔐</span> Admin
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '10px', padding: '0.875rem 1rem',
              color: '#b91c1c', fontSize: '0.85rem',
              marginBottom: '1.5rem', lineHeight: 1.5
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Student Google Sign-In (Removed in Admin Mode) */}
          {activeTab === 'student' && (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  id="google-signin-btn"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.9rem',
                    background: loading ? '#f1f5f9' : 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    fontSize: '0.975rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    opacity: loading ? 0.7 : 1
                  }}
                  onMouseOver={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)'; } }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                >
                  {loading ? (
                    <div style={{ width: '20px', height: '20px', border: '2px solid #cbd5e1', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 48 48">
                      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,19.000,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                    </svg>
                  )}
                  {loading ? 'Signing in...' : 'Sign in with Google'}
                </button>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, height: '1px', background: '#cbd5e1' }} />
                <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>or manual entry</span>
                <div style={{ flex: 1, height: '1px', background: '#cbd5e1' }} />
              </div>
            </>
          )}

          {/* Student Manual Login Form */}
          {activeTab === 'student' && (
            <form onSubmit={handleStudentManualLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="student-email" style={{ display: 'block', color: '#475569', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Username or Email</label>
                <input
                  type="text"
                  id="student-email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="Enter your username or email"
                  required
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px', color: '#0f172a',
                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
                />
              </div>

              <div>
                <label htmlFor="student-password" style={{ display: 'block', color: '#475569', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Password</label>
                <input
                  type="password"
                  id="student-password"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px', color: '#0f172a',
                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '0.5rem',
                  width: '100%', padding: '0.85rem',
                  background: loading ? 'rgba(59,130,246,0.5)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  border: 'none', borderRadius: '12px',
                  color: 'white', fontWeight: 600, fontSize: '0.95rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(59,130,246,0.15)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; }}
              >
                {loading ? 'Logging in...' : 'Login as Student'}
              </button>
            </form>
          )}

          {/* Admin Manual Login Form (No Google Login Option rendered above) */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminManualLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="admin-email" style={{ display: 'block', color: '#475569', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Admin Email or Username</label>
                <input
                  type="text"
                  id="admin-email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="Gate2026@gmail.com or admin"
                  required
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px', color: '#0f172a',
                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#8b5cf6'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
                />
              </div>

              <div>
                <label htmlFor="admin-password" style={{ display: 'block', color: '#475569', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Password</label>
                <input
                  type="password"
                  id="admin-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px', color: '#0f172a',
                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#8b5cf6'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '0.5rem',
                  width: '100%', padding: '0.85rem',
                  background: loading ? 'rgba(139,92,246,0.5)' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  border: 'none', borderRadius: '12px',
                  color: 'white', fontWeight: 600, fontSize: '0.95rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(139,92,246,0.15)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; }}
              >
                {loading ? 'Logging in...' : 'Login as Admin'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', marginTop: '1.5rem' }}>
          {activeTab === 'student' ? 'Student login grants access to the practice dashboard' : 'Admin: use admin credentials setup'}
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
