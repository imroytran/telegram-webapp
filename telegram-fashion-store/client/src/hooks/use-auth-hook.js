// client/src/hooks/useAuth.js - Хук для работы с аутентификацией
import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useTelegram } from './useTelegram';
import api from '../utils/api';

export const useAuth = () => {
  const { state, actions } = useAppContext();
  const { user, isAuth, isAdmin, isLoading, error } = state;
  const { tg, user: telegramUser } = useTelegram();

  // Авторизация через Telegram
  const loginWithTelegram = useCallback(async () => {
    if (isAuth) return true;

    try {
      await actions.authWithTelegram();
      return true;
    } catch (error) {
      console.error('Login with Telegram error:', error);
      return false;
    }
  }, [isAuth, actions]);

  // Авторизация администратора через email и пароль
  const loginAdmin = useCallback(async (email, password) => {
    if (isAuth) return true;

    try {
      const { data } = await api.post('/auth/admin/login', { email, password });

      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        actions.loadUser();
        return true;
      } else {
        throw new Error('Ошибка авторизации');
      }
    } catch (error) {
      console.error('Login admin error:', error);
      actions.showNotification(
        error.response?.data?.error || 'Ошибка авторизации',
        'error'
      );
      return false;
    }
  }, [isAuth, actions]);

  // Авторизация администратора через Telegram ID
  const loginAdminWithTelegram = useCallback(async (telegramId) => {
    if (isAuth) return true;

    try {
      const { data } = await api.post('/auth/admin/telegram', { telegramId });

      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        actions.loadUser();
        return true;
      } else {
        throw new Error('Ошибка авторизации');
      }
    } catch (error) {
      console.error('Login admin with Telegram error:', error);
      actions.showNotification(
        error.response?.data?.error || 'Ошибка авторизации',
        'error'
      );
      return false;
    }
  }, [isAuth, actions]);

  // Выход из аккаунта
  const logout = useCallback(() => {
    actions.logout();
  }, [actions]);

  // Обновление профиля пользователя
  const updateProfile = useCallback(async (profileData) => {
    if (!isAuth) return false;

    try {
      const { data } = await api.put('/auth/profile', profileData);

      if (data.success) {
        // Обновляем данные пользователя в контексте
        actions.loadUser();
        actions.showNotification('Профиль успешно обновлен', 'success');
        return true;
      } else {
        throw new Error('Ошибка обновления профиля');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      actions.showNotification(
        error.response?.data?.error || 'Ошибка обновления профиля',
        'error'
      );
      return false;
    }
  }, [isAuth, actions]);

  // Добавление адреса
  const addAddress = useCallback(async (addressData) => {
    if (!isAuth) return false;

    try {
      const { data } = await api.post('/auth/address', addressData);

      if (data.success) {
        // Обновляем данные пользователя в контексте
        actions.loadUser();
        actions.showNotification('Адрес успешно добавлен', 'success');
        return true;
      } else {
        throw new Error('Ошибка добавления адреса');
      }
    } catch (error) {
      console.error('Add address error:', error);
      actions.showNotification(
        error.response?.data?.error || 'Ошибка добавления адреса',
        'error'
      );
      return false;
    }
  }, [isAuth, actions]);

  // Обновление адреса
  const updateAddress = useCallback(async (addressId, addressData) => {
    if (!isAuth) return false;

    try {
      const { data } = await api.put(`/auth/address/${addressId}`, addressData);

      if (data.success) {
        // Обновляем данные пользователя в контексте
        actions.loadUser();
        actions.showNotification('Адрес успешно обновлен', 'success');
        return true;
      } else {
        throw new Error('Ошибка обновления адреса');
      }
    } catch (error) {
      console.error('Update address error:', error);
      actions.showNotification(
        error.response?.data?.error || 'Ошибка обновления адреса',
        'error'
      );
      return false;
    }
  }, [isAuth, actions]);

  // Удаление адреса
  const deleteAddress = useCallback(async (addressId) => {
    if (!isAuth) return false;

    try {
      const { data } = await api.delete(`/auth/address/${addressId}`);

      if (data.success) {
        // Обновляем данные пользователя в контексте
        actions.loadUser();
        actions.showNotification('Адрес успешно удален', 'success');
        return true;
      } else {
        throw new Error('Ошибка удаления адреса');
      }
    } catch (error) {
      console.error('Delete address error:', error);
      actions.showNotification(
        error.response?.data?.error || 'Ошибка удаления адреса',
        'error'
      );
      return false;
    }
  }, [isAuth, actions]);

  // Проверка, имеет ли пользователь доступ к административной панели
  const checkAdminAccess = useCallback(() => {
    return isAuth && isAdmin;
  }, [isAuth, isAdmin]);

  // Получение токена авторизации
  const getToken = useCallback(() => {
    return localStorage.getItem('token');
  }, []);

  return {
    user,
    isAuth,
    isAdmin,
    isLoading,
    error,
    loginWithTelegram,
    loginAdmin,
    loginAdminWithTelegram,
    logout,
    updateProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    checkAdminAccess,
    getToken
  };
};