import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import './Sidebar.css';

export default function Sidebar({ onNewChat }) {
  const navigate = useNavigate();
  const { balance, logout } = useUser();

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">Loghme</div>
      <button type="button" className="app-sidebar__btn" onClick={onNewChat}>
        گفتگوی جدید
      </button>
      <div className="app-sidebar__section-title">گفتگوهای اخیر</div>
      <ul className="app-sidebar__list">
        <li className="app-sidebar__placeholder">هنوز گفتگویی ذخیره نشده</li>
      </ul>
      <div className="app-sidebar__footer">
        {balance != null && (
          <div className="app-sidebar__balance">
            موجودی: <strong>{Number(balance).toLocaleString('fa-IR')}</strong>
          </div>
        )}
        <button
          type="button"
          className="app-sidebar__link"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
        >
          خروج
        </button>
      </div>
    </aside>
  );
}
