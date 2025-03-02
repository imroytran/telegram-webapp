// client/src/hooks/useOrders.js - Хук для работы с заказами
import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import api from '../utils/api';

export const useOrders = () => {
  const { state, actions } = useAppContext();
  const { isAuth, isAdmin } = state;
  
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [paymentLink, setPaymentLink] = useState(null);

  // Загрузка списка заказов пользователя или всех заказов для администратора
  const loadOrders = useCallback(async (page = 1, limit = 10, filters = {}) => {
    if (!isAuth) return;
    
    setLoading(true);
    setError(null);

    try {
      let endpoint = '/orders';
      const params = { page, limit };
      
      // Для администратора используем другой эндпоинт и добавляем фильтры
      if (isAdmin) {
        endpoint = '/orders/admin/all';
        
        if (filters.status) params.status = filters.status;
        if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
        if (filters.search) params.search = filters.search;
        if (filters.sortBy) {
          params.sortBy = filters.sortBy;
          params.sortOrder = filters.sortOrder || 'desc';
        }
      }

      const { data } = await api.get(endpoint, { params });

      if (data.success) {
        setOrders(data.orders);
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          pages: data.pagination.pages
        });
      } else {
        setError('Ошибка загрузки заказов');
      }
    } catch (err) {
      console.error('Load orders error:', err);
      setError(err.response?.data?.error || 'Ошибка загрузки заказов');
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin]);

  // Загрузка информации о заказе по ID
  const loadOrder = useCallback(async (id) => {
    if (!isAuth) return;
    
    setLoading(true);
    setError(null);
    setOrder(null);
    setPaymentLink(null);

    try {
      const { data } = await api.get(`/orders/${id}`);

      if (data.success && data.order) {
        setOrder(data.order);
        
        // Если есть ссылка на оплату, сохраняем ее
        if (data.paymentLink) {
          setPaymentLink(data.paymentLink);
        }
      } else {
        setError('Заказ не найден');
      }
    } catch (err) {
      console.error('Load order error:', err);
      setError(err.response?.data?.error || 'Ошибка загрузки заказа');
    } finally {
      setLoading(false);
    }
  }, [isAuth]);

  // Создание заказа на основе корзины
  const createOrder = useCallback(async (orderData) => {
    if (!isAuth) return null;
    
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post('/orders', orderData);

      if (data.success && data.order) {
        setOrder(data.order);
        
        // Если есть ссылка на оплату, сохраняем ее
        if (data.paymentLink) {
          setPaymentLink(data.paymentLink);
        }
        
        // Показываем уведомление
        actions.showNotification('Заказ успешно создан', 'success');
        
        // Возвращаем созданный заказ
        return data.order;
      } else {
        throw new Error('Ошибка создания заказа');
      }
    } catch (err) {
      console.error('Create order error:', err);
      
      const errorMessage = err.response?.data?.error || 'Ошибка создания заказа';
      setError(errorMessage);
      actions.showNotification(errorMessage, 'error');
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuth, actions]);

  // Отмена заказа пользователем
  const cancelOrder = useCallback(async (id, reason) => {
    if (!isAuth) return false;
    
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post(`/orders/${id}/cancel`, { cancelReason: reason });

      if (data.success) {
        // Обновляем заказ в состоянии
        setOrder(data.order);
        
        // Показываем уведомление
        actions.showNotification('Заказ успешно отменен', 'success');
        
        return true;
      } else {
        throw new Error('Ошибка отмены заказа');
      }
    } catch (err) {
      console.error('Cancel order error:', err);
      
      const errorMessage = err.response?.data?.error || 'Ошибка отмены заказа';
      setError(errorMessage);
      actions.showNotification(errorMessage, 'error');
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuth, actions]);

  // Функции для администратора

  // Обновление статуса заказа
  const updateOrderStatus = useCallback(async (id, status, comment) => {
    if (!isAuth || !isAdmin) return false;
    
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.put(`/orders/admin/${id}/status`, { status, comment });

      if (data.success) {
        // Обновляем заказ в состоянии
        setOrder(data.order);
        
        // Показываем уведомление
        actions.showNotification(`Статус заказа изменен на "${status}"`, 'success');
        
        return true;
      } else {
        throw new Error('Ошибка обновления статуса заказа');
      }
    } catch (err) {
      console.error('Update order status error:', err);
      
      const errorMessage = err.response?.data?.error || 'Ошибка обновления статуса заказа';
      setError(errorMessage);
      actions.showNotification(errorMessage, 'error');
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, actions]);

  // Обновление статуса оплаты заказа
  const updatePaymentStatus = useCallback(async (id, paymentStatus, transactionId) => {
    if (!isAuth || !isAdmin) return false;
    
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.put(`/orders/admin/${id}/payment`, { paymentStatus, transactionId });

      if (data.success) {
        // Обновляем заказ в состоянии
        setOrder(data.order);
        
        // Показываем уведомление
        actions.showNotification(`Статус оплаты изменен на "${paymentStatus}"`, 'success');
        
        return true;
      } else {
        throw new Error('Ошибка обновления статуса оплаты');
      }
    } catch (err) {
      console.error('Update payment status error:', err);
      
      const errorMessage = err.response?.data?.error || 'Ошибка обновления статуса оплаты';
      setError(errorMessage);
      actions.showNotification(errorMessage, 'error');
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, actions]);

  // Добавление трекинг-номера
  const addTrackingNumber = useCallback(async (id, trackingNumber, estimatedDeliveryDate) => {
    if (!isAuth || !isAdmin) return false;
    
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.put(`/orders/admin/${id}/tracking`, { 
        trackingNumber, 
        estimatedDeliveryDate 
      });

      if (data.success) {
        // Обновляем заказ в состоянии
        setOrder(data.order);
        
        // Показываем уведомление
        actions.showNotification('Трекинг-номер успешно добавлен', 'success');
        
        return true;
      } else {
        throw new Error('Ошибка добавления трекинг-номера');
      }
    } catch (err) {
      console.error('Add tracking number error:', err);
      
      const errorMessage = err.response?.data?.error || 'Ошибка добавления трекинг-номера';
      setError(errorMessage);
      actions.showNotification(errorMessage, 'error');
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuth, isAdmin, actions]);

  // Получение статистики заказов (только для администратора)
  const [statistics, setStatistics] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const loadStatistics = useCallback(async (period = 'month') => {
    if (!isAuth || !isAdmin) return;
    
    setLoadingStats(true);

    try {
      const { data } = await api.get('/orders/admin/statistics', { params: { period } });

      if (data.success) {
        setStatistics(data.statistics);
      }
    } catch (err) {
      console.error('Load statistics error:', err);
      actions.showNotification('Ошибка загрузки статистики', 'error');
    } finally {
      setLoadingStats(false);
    }
  }, [isAuth, isAdmin, actions]);

  // Автоматическая загрузка заказов при монтировании компонента
  useEffect(() => {
    if (isAuth) {
      loadOrders();
    }
  }, [isAuth, loadOrders]);

  // Функция для обновления текущей страницы пагинации
  const changePage = (page) => {
    loadOrders(page, pagination.limit);
  };

  return {
    orders,
    order,
    loading,
    error,
    pagination,
    paymentLink,
    statistics,
    loadingStats,
    loadOrders,
    loadOrder,
    createOrder,
    cancelOrder,
    changePage,
    updateOrderStatus,
    updatePaymentStatus,
    addTrackingNumber,
    loadStatistics
  };
};
