import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard,
  PlusCircle,
  BarChart3,
  History,
  LogOut,
  Pin,
  PinOff,
  Bell,
  ChevronRight,
} from 'lucide-react';
import HeaderTimer from './Timer';

const LOGO_URL = 'https://res.cloudinary.com/ddhlqymvf/image/upload/v1784556100/Logo_Modo_Cavernas_1_bk1g0x.png';

const navItems = [
  { to: '/',            icon: LayoutDashboard, label: 'Início' },
  { to: '/gerar',       icon: PlusCircle,      label: 'Gerar' },
  { to: '/estatisticas',icon: BarChart3,        label: 'Stats' },
  { to: '/historico',   icon: History,          label: 'Histórico' },
];

function getBreadcrumbs(path: string): string[] {
  if (path === '/')              return ['Início'];
  if (path === '/gerar')         return ['Início', 'Gerar'];
  if (path === '/resolver')      return ['Início', 'Simulado'];
  if (path === '/resultados')    return ['Início', 'Resultados'];
  if (path === '/estatisticas')  return ['Início', 'Estatísticas'];
  if (path === '/historico')     return ['Início', 'Histórico'];
  return ['Início'];
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const { modoCaverna, toggleModoCaverna } = useTheme();
  const location = useLocation();

  const [isPinned, setIsPinned] = useState(() => localStorage.getItem('sidebar-pinned') === 'true');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar-pinned', String(isPinned));
  }, [isPinned]);

  const isExpanded = isHovered || isPinned;
  const userInitial = user?.email?.charAt(0).toUpperCase() || '?';
  const breadcrumbs = getBreadcrumbs(location.pathname);

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header className="app-header">
        {/* Left: Logo + breadcrumb */}
        <div className="header-left">
          <div className="header-logo">
            <img src={LOGO_URL} alt="Modo Caverna" />
          </div>
          <div className="header-breadcrumbs">
            {breadcrumbs.map((part, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {i > 0 && <ChevronRight size={9} />}
                {part}
              </span>
            ))}
          </div>
        </div>

        {/* Center: Timer */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <HeaderTimer />
        </div>

        {/* Right: actions */}
        <div className="header-right">
          {/* Modo Caverna Label & Toggle Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}>
            <span style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: modoCaverna ? 'var(--brand)' : 'var(--muted-foreground)',
              textTransform: 'uppercase'
            }}>
              {modoCaverna ? 'MODO CAVERNA ATIVO' : 'ATIVAR MODO CAVERNA'}
            </span>
            <button
              onClick={toggleModoCaverna}
              title={modoCaverna ? 'Desativar Modo Caverna' : 'Ativar Modo Caverna'}
              style={{
                background: modoCaverna ? 'var(--brand)' : 'transparent',
                border: '1px solid var(--border)',
                width: '32px',
                height: '16px',
                position: 'relative',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '1px',
                transition: 'background-color 300ms ease'
              }}
            >
              <div style={{
                background: modoCaverna ? '#FFFFFF' : 'var(--muted-foreground)',
                width: '12px',
                height: '12px',
                transform: modoCaverna ? 'translateX(16px)' : 'translateX(0px)',
                transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms ease'
              }} />
            </button>
          </div>

          <button className="header-btn" title="Notificações">
            <Bell size={15} />
          </button>
          <div className="header-avatar" title={user?.email}>
            {userInitial}
          </div>
        </div>
      </header>

      <div className="app-content">
        {/* ── Sidebar (desktop only) ── */}
        <aside
          className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <nav className="sidebar-nav">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                {({ isActive }) => (
                  <>
                    {isActive && <div className="sidebar-link-active-indicator" />}
                    <span className="sidebar-link-icon">
                      <Icon size={17} strokeWidth={1.3} />
                    </span>
                    <span className="sidebar-link-label">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button
              className="sidebar-link"
              onClick={() => setIsPinned(p => !p)}
              title={isPinned ? 'Desafixar' : 'Fixar'}
            >
              <span className="sidebar-link-icon">
                {isPinned
                  ? <PinOff size={17} strokeWidth={1.3} />
                  : <Pin     size={17} strokeWidth={1.3} />}
              </span>
              <span className="sidebar-link-label">
                {isPinned ? 'Desafixar' : 'Fixar Menu'}
              </span>
            </button>

            <button
              className="sidebar-link"
              onClick={signOut}
              style={{ color: 'var(--error)' }}
              title="Sair"
            >
              <span className="sidebar-link-icon">
                <LogOut size={17} strokeWidth={1.3} />
              </span>
              <span className="sidebar-link-label">Sair</span>
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className={`main-view${isPinned ? ' sidebar-pinned' : ''}`}>
          <Outlet />
        </main>
      </div>

      {/* ── Bottom Navigation (mobile only) ── */}
      <nav className="bottom-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={20} strokeWidth={1.3} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button className="bottom-nav-item" onClick={signOut} style={{ color: 'var(--error)' }}>
          <LogOut size={20} strokeWidth={1.3} />
          <span>Sair</span>
        </button>
      </nav>
    </div>
  );
}
