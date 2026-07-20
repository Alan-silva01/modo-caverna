import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Eye, EyeOff } from 'lucide-react';

const LOGO_URL = 'https://res.cloudinary.com/ddhlqymvf/image/upload/v1784556100/Logo_Modo_Cavernas_1_bk1g0x.png';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (!email || !password) {
      setError('Preencha todos os campos');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (isLogin) {
      const { error: err } = await signIn(email, password);
      if (err) setError('Email ou senha incorretos');
    } else {
      const { error: err } = await signUp(email, password);
      if (err) setError(err.message || 'Erro ao criar conta');
      else setSuccessMsg('Conta criada! Verifique seu email.');
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* Fundo fantasma logo */}
      <div className="login-bg" />

      <div className="login-container">
        {/* Header */}
        <div className="login-header">
          <img
            src={LOGO_URL}
            alt="Modo Caverna"
            className="login-logo-img"
          />
          <h1 className="login-title">Modo Caverna</h1>
          <p className="login-subtitle">
            {isLogin ? 'Acesse sua conta' : 'Crie sua conta'}
          </p>
        </div>

        {/* Form card */}
        <div className="login-card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted-foreground)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && <p className="form-error" style={{ marginBottom: '12px' }}>{error}</p>}
            {successMsg && (
              <p className="text-sm" style={{ color: 'var(--success)', marginBottom: '12px' }}>
                {successMsg}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={loading}
            >
              {loading ? (
                <span>AGUARDE...</span>
              ) : (
                <>
                  <Shield size={14} />
                  {isLogin ? 'ENTRAR' : 'CRIAR CONTA'}
                </>
              )}
            </button>
          </form>

          <div className="login-toggle">
            {isLogin ? 'Não tem conta?' : 'Já tem conta?'}
            <button
              onClick={() => {
                setIsLogin(l => !l);
                setError('');
                setSuccessMsg('');
              }}
            >
              {isLogin ? 'Criar conta' : 'Fazer login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
