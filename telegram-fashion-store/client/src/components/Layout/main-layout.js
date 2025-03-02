// client/src/components/Layout/MainLayout.js - Основной макет приложения
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { useTelegram } from '../../hooks/useTelegram';
import './MainLayout.css';

const MainLayout = ({ children }) => {
  const { state } = useAppContext();
  const { isAuth, isAdmin, cart } = state;
  const { tg, adaptTheme } = useTelegram();
  const location = useLocation();

  // Применяем тему Telegram
  adaptTheme();

  // Проверяем, является ли текущий маршрут административным
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Определяем, показывать ли панель навигации
  const showNavbar = isAuth && !isAdminRoute;
  
  // Получаем количество товаров в корзине
  const cartItemCount = cart?.items?.length || 0;

  return (
    <div className="main-layout">
      {/* Верхняя панель */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            {isAdminRoute && (
              <Link to="/admin" className="logo">
                Admin Panel
              </Link>
            )}
            {!isAdminRoute && (
              <Link to="/" className="logo">
                FASHION SHOP
              </Link>
            )}
          </div>
          <div className="header-right">
            {isAdmin && !isAdminRoute && (
              <Link to="/admin" className="admin-link">
                <i className="icon admin-icon"></i>
                Админ
              </Link>
            )}
            
            {isAuth && !isAdminRoute && (
              <Link to="/profile" className="profile-link">
                <i className="icon profile-icon"></i>
                Профиль
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="main-content">
        {children}
      </main>

      {/* Нижняя панель навигации */}
      {showNavbar && (
        <nav className="bottom-navbar">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            <i className="icon home-icon"></i>
            <span>Главная</span>
          </Link>
          <Link to="/catalog" className={location.pathname.startsWith('/catalog') ? 'active' : ''}>
            <i className="icon catalog-icon"></i>
            <span>Каталог</span>
          </Link>
          <Link to="/cart" className={location.pathname === '/cart' ? 'active' : ''}>
            <i className="icon cart-icon"></i>
            <span>Корзина</span>
            {cartItemCount > 0 && (
              <span className="cart-badge">{cartItemCount}</span>
            )}
          </Link>
          <Link to="/orders" className={location.pathname.startsWith('/orders') ? 'active' : ''}>
            <i className="icon orders-icon"></i>
            <span>Заказы</span>
          </Link>
        </nav>
      )}

      {/* Административная панель навигации */}
      {isAuth && isAdmin && isAdminRoute && (
        <nav className="bottom-navbar admin-navbar">
          <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>
            <i className="icon dashboard-icon"></i>
            <span>Дашборд</span>
          </Link>
          <Link to="/admin/products" className={location.pathname.startsWith('/admin/products') ? 'active' : ''}>
            <i className="icon products-icon"></i>
            <span>Товары</span>
          </Link>
          <Link to="/admin/orders" className={location.pathname.startsWith('/admin/orders') ? 'active' : ''}>
            <i className="icon orders-icon"></i>
            <span>Заказы</span>
          </Link>
          <Link to="/admin/users" className={location.pathname.startsWith('/admin/users') ? 'active' : ''}>
            <i className="icon users-icon"></i>
            <span>Клиенты</span>
          </Link>
          <Link to="/" className="exit-admin">
            <i className="icon exit-icon"></i>
            <span>Выйти</span>
          </Link>
        </nav>
      )}

      {/* Уведомление */}
      {state.notification && (
        <div className={`notification ${state.notification.type}`}>
          <span>{state.notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
