// client/src/hooks/useAdmin.js - Хук для административных функций
import { useState, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import api from '../utils/api';

export const useAdmin = () => {
  const { state, actions } = useAppContext();
  const { isAuth, isAdmin } = state;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [userPagination, setUserPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // Получение статистики магазина
  const loadStatistics = useCallback(async () => {
    if (!isAuth || !isAdmin) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.get('/admin/statistics');

      if (data.success && data.statistics) {
        setStatistics(data.statistics);
      } else {
        throw new Error('Ошибка загрузки статистики');
      }
    } catch (err) {
      console.error('Load statistics error:', err);
      setError(err.response?.data?.error || 'Ошибка загрузки статистики');
      actions.showNotification('Ошибка загрузки статистики', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, actions]);

  // Получение списка администраторов (только для суперадмина)
  const loadAdmins = useCallback(async () => {
    if (!isAuth || !isAdmin) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.get('/admin/admins');

      if (data.success && data.admins) {
        setAdmins(data.admins);
      } else {
        throw new Error('Ошибка загрузки списка администраторов');
      }
    } catch (err) {
      console.error('Load admins error:', err);
      setError(err.response?.data?.error || 'Ошибка загрузки списка администраторов');
      
      if (err.response?.status === 403) {
        actions.showNotification('Доступно только для суперадминистратора', 'warning');
      } else {
        actions.showNotification('Ошибка загрузки списка администраторов', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, actions]);

  // Создание нового администратора (только для суперадмина)
  const createAdmin = useCallback(async (adminData) => {
    if (!isAuth || !isAdmin) return null;
    
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post('/admin/admins', adminData);

      if (data.success && data.admin) {
        // Обновляем список администраторов
        loadAdmins();
        
        // Показываем уведомление
        actions.showNotification('Администратор успешно создан', 'success');
        
        return data.admin;
      } else {
        throw new Error('Ошибка создания администратора');
      }
    } catch (err) {
      console.error('Create admin error:', err);
      
      const errorMessage = err.response?.data?.error || 'Ошибка создания администратора';
      setError(errorMessage);
      
      if (err.response?.status === 403) {
        actions.showNotification('Доступно только для суперадминистратора', 'warning');
      } else {
        actions.showNotification(errorMessage, 'error');
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, loadAdmins, actions]);

  // Обновление администратора (только для суперадмина)
  const updateAdmin = useCallback(async (id, adminData) => {
    if (!isAuth || !isAdmin) return false;
    
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.put(`/admin/admins/${id}`, adminData);

      if (data.success && data.admin) {
        // Обновляем список администраторов
        loadAdmins();
        
        // Показываем уведомление
        actions.showNotification('Администратор успешно обновлен', 'success');
        
        return true;
      } else {
        throw new Error('Ошибка обновления администратора');
      }
    } catch (err) {
      console.error('Update admin error:', err);
      
      const errorMessage = err.response?.data?.error || 'Ошибка обновления администратора';
      setError(errorMessage);
      
      if (err.response?.status === 403) {
        actions.showNotification('Доступно только для суперадминистратора', 'warning');
      } else {
        actions.showNotification(errorMessage, 'error');
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, loadAdmins, actions]);

  // Удаление администратора (только для суперадмина)
  const deleteAdmin = useCallback(async (id) => {
    if (!isAuth || !isAdmin) return false;
    
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.delete(`/admin/admins/${id}`);

      if (data.success) {
        // Обновляем список администраторов
        loadAdmins();
        
        // Показываем уведомление
        actions.showNotification('Администратор успешно удален', 'success');
        
        return true;
      } else {
        throw new Error('Ошибка удаления администратора');
      }
    } catch (err) {
      console.error('Delete admin error:', err);
      
      const errorMessage = err.response?.data?.error || 'Ошибка удаления администратора';
      setError(errorMessage);
      
      if (err.response?.status === 403) {
        actions.showNotification('Доступно только для суперадминистратора', 'warning');
      } else {
        actions.showNotification(errorMessage, 'error');
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, loadAdmins, actions]);

  // Получение списка пользователей
  const loadUsers = useCallback(async (page = 1, limit = 10, search = '') => {
    if (!isAuth || !isAdmin) return;
    
    setLoading(true);
    setError(null);

    try {
      const params = { page, limit };
      if (search) params.search = search;
      
      const { data } = await api.get('/admin/users', { params });

      if (data.success && data.users) {
        setUsers(data.users);
        setUserPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          pages: data.pagination.pages
        });
      } else {
        throw new Error('Ошибка загрузки списка пользователей');
      }
    } catch (err) {
      console.error('Load users error:', err);
      setError(err.response?.data?.error || 'Ошибка загрузки списка пользователей');
      actions.showNotification('Ошибка загрузки списка пользователей', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, actions]);

  // Получение информации о пользователе
  const [user, setUser] = useState(null);
  const [userOrders, setUserOrders] = useState([]);

  const loadUser = useCallback(async (id) => {
    if (!isAuth || !isAdmin) return;
    
    setLoading(true);
    setError(null);
    setUser(null);
    setUserOrders([]);

    try {
      const { data } = await api.get(`/admin/users/${id}`);

      if (data.success) {
        setUser(data.user);
        if (data.orders) {
          setUserOrders(data.orders);
        }
      } else {
        throw new Error('Ошибка загрузки информации о пользователе');
      }
    } catch (err) {
      console.error('Load user error:', err);
      setError(err.response?.data?.error || 'Ошибка загрузки информации о пользователе');
      actions.showNotification('Ошибка загрузки информации о пользователе', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, actions]);

  // Импорт товара с Ozon
  const [ozonProduct, setOzonProduct] = useState(null);

  const importFromOzon = useCallback(async (url) => {
    if (!isAuth || !isAdmin) return null;
    
    setLoading(true);
    setError(null);
    setOzonProduct(null);

    try {
      const { data } = await api.post('/admin/import-ozon', { url });

      if (data.success && data.product) {
        setOzonProduct(data.product);
        actions.showNotification('Товар успешно импортирован из Ozon', 'success');
        return data.product;
      } else {
        throw new Error('Ошибка импорта товара из Ozon');
      }
    } catch (err) {
      console.error('Import from Ozon error:', err);
      
      const errorMessage = err.response?.data?.error || 'Ошибка импорта товара из Ozon';
      setError(errorMessage);
      actions.showNotification(errorMessage, 'error');
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, actions]);

  // Создание товара из данных Ozon
  const createProductFromOzon = useCallback(async (productData) => {
    if (!isAuth || !isAdmin) return null;
    
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post('/admin/create-from-ozon', productData);

      if (data.success && data.product) {
        actions.showNotification('Товар успешно создан', 'success');
        return data.product;
      } else {
        throw new Error('Ошибка создания товара');
      }
    } catch (err) {
      console.error('Create product from Ozon error:', err);
      
      const errorMessage = err.response?.data?.error || 'Ошибка создания товара';
      setError(errorMessage);
      actions.showNotification(errorMessage, 'error');
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, actions]);

  // Функция для обновления страницы пагинации пользователей
  const changeUserPage = (page) => {
    loadUsers(page, userPagination.limit);
  };

  return {
    loading,
    error,
    statistics,
    admins,
    users,
    user,
    userOrders,
    userPagination,
    ozonProduct,
    loadStatistics,
    loadAdmins,
    createAdmin,
    updateAdmin,
    deleteAdmin,
    loadUsers,
    loadUser,
    changeUserPage,
    importFromOzon,
    createProductFromOzon
  };
};
