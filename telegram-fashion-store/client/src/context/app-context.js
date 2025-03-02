// client/src/context/AppContext.js - Основной контекст приложения
import React, { createContext, useReducer, useContext, useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import api from '../utils/api';

// Состояние по умолчанию
const initialState = {
  user: null,
  isAdmin: false,
  isAuth: false,
  isLoading: false,
  error: null,
  cart: {
    items: [],
    total: 0
  },
  categories: [],
  filters: {
    category: '',
    minPrice: 0,
    maxPrice: 10000,
    size: '',
    color: ''
  },
  notification: null
};

// Типы действий
const types = {
  SET_USER: 'SET_USER',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_CART: 'SET_CART',
  UPDATE_CART_ITEM: 'UPDATE_CART_ITEM',
  REMOVE_CART_ITEM: 'REMOVE_CART_ITEM',
  CLEAR_CART: 'CLEAR_CART',
  SET_CATEGORIES: 'SET_CATEGORIES',
  SET_FILTERS: 'SET_FILTERS',
  SET_NOTIFICATION: 'SET_NOTIFICATION',
  CLEAR_NOTIFICATION: 'CLEAR_NOTIFICATION'
};

// Редуктор
const reducer = (state, action) => {
  switch (action.type) {
    case types.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAdmin: action.payload?.isAdmin || false,
        isAuth: true,
        isLoading: false,
        error: null
      };
    case types.LOGOUT:
      localStorage.removeItem('token');
      return {
        ...state,
        user: null,
        isAdmin: false,
        isAuth: false,
        error: null
      };
    case types.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };
    case types.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
    case types.SET_CART:
      return {
        ...state,
        cart: action.payload
      };
    case types.UPDATE_CART_ITEM:
      return {
        ...state,
        cart: {
          ...state.cart,
          items: state.cart.items.map((item, index) => 
            index === action.payload.index 
              ? { ...item, quantity: action.payload.quantity } 
              : item
          )
        }
      };
    case types.REMOVE_CART_ITEM:
      return {
        ...state,
        cart: {
          ...state.cart,
          items: state.cart.items.filter((_, index) => index !== action.payload)
        }
      };
    case types.CLEAR_CART:
      return {
        ...state,
        cart: {
          items: [],
          total: 0
        }
      };
    case types.SET_CATEGORIES:
      return {
        ...state,
        categories: action.payload
      };
    case types.SET_FILTERS:
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.payload
        }
      };
    case types.SET_NOTIFICATION:
      return {
        ...state,
        notification: {
          message: action.payload.message,
          type: action.payload.type || 'info',
          duration: action.payload.duration || 3000
        }
      };
    case types.CLEAR_NOTIFICATION:
      return {
        ...state,
        notification: null
      };
    default:
      return state;
  }
};

// Создаем контекст
const AppContext = createContext();

// Провайдер контекста
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { tg, user: telegramUser } = useTelegram();

  // Действия контекста
  const actions = {
    // Авторизация пользователя через Telegram
    authWithTelegram: async () => {
      if (!telegramUser) {
        return dispatch({
          type: types.SET_ERROR,
          payload: 'Не удалось получить данные пользователя Telegram'
        });
      }

      dispatch({ type: types.SET_LOADING, payload: true });

      try {
        const { data } = await api.post('/auth/user/telegram', {
          telegramId: telegramUser.id,
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name
        });

        if (data.success && data.token) {
          localStorage.setItem('token', data.token);
          dispatch({ type: types.SET_USER, payload: data.user });
          
          // Загружаем корзину пользователя
          actions.loadCart();
        } else {
          dispatch({ type: types.SET_ERROR, payload: 'Ошибка авторизации' });
        }
      } catch (error) {
        console.error('Auth error:', error);
        dispatch({ 
          type: types.SET_ERROR, 
          payload: error.response?.data?.error || 'Ошибка авторизации' 
        });
      }
    },

    // Получение данных текущего пользователя
    loadUser: async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      dispatch({ type: types.SET_LOADING, payload: true });

      try {
        const { data } = await api.get('/auth/me');

        if (data.success && data.user) {
          dispatch({ type: types.SET_USER, payload: data.user });
        } else {
          dispatch({ type: types.LOGOUT });
        }
      } catch (error) {
        console.error('Load user error:', error);
        dispatch({ type: types.LOGOUT });
      }
    },

    // Выход пользователя
    logout: () => {
      dispatch({ type: types.LOGOUT });
    },

    // Получение корзины пользователя
    loadCart: async () => {
      if (!state.isAuth) return;

      dispatch({ type: types.SET_LOADING, payload: true });

      try {
        const { data } = await api.get('/cart');

        if (data.success && data.cart) {
          dispatch({ type: types.SET_CART, payload: data.cart });
        }
      } catch (error) {
        console.error('Load cart error:', error);
        dispatch({ 
          type: types.SET_ERROR, 
          payload: error.response?.data?.error || 'Ошибка загрузки корзины' 
        });
      } finally {
        dispatch({ type: types.SET_LOADING, payload: false });
      }
    },

    // Добавление товара в корзину
    addToCart: async (productId, size, color, quantity = 1) => {
      if (!state.isAuth) {
        dispatch({
          type: types.SET_NOTIFICATION,
          payload: {
            message: 'Пожалуйста, авторизуйтесь для добавления товара в корзину',
            type: 'warning'
          }
        });
        return;
      }

      dispatch({ type: types.SET_LOADING, payload: true });

      try {
        const { data } = await api.post('/cart/add', {
          productId,
          size,
          color,
          quantity
        });

        if (data.success && data.cart) {
          dispatch({ type: types.SET_CART, payload: data.cart });
          dispatch({
            type: types.SET_NOTIFICATION,
            payload: {
              message: 'Товар добавлен в корзину',
              type: 'success'
            }
          });
        }
      } catch (error) {
        console.error('Add to cart error:', error);
        dispatch({ 
          type: types.SET_NOTIFICATION, 
          payload: {
            message: error.response?.data?.error || 'Ошибка добавления товара в корзину',
            type: 'error'
          }
        });
      } finally {
        dispatch({ type: types.SET_LOADING, payload: false });
      }
    },

    // Обновление количества товара в корзине
    updateCartItem: async (itemIndex, quantity) => {
      if (!state.isAuth) return;

      dispatch({ type: types.SET_LOADING, payload: true });

      try {
        const { data } = await api.put(`/cart/update/${itemIndex}`, {
          quantity
        });

        if (data.success && data.cart) {
          dispatch({ type: types.SET_CART, payload: data.cart });
        }
      } catch (error) {
        console.error('Update cart item error:', error);
        dispatch({ 
          type: types.SET_NOTIFICATION, 
          payload: {
            message: error.response?.data?.error || 'Ошибка обновления корзины',
            type: 'error'
          }
        });
      } finally {
        dispatch({ type: types.SET_LOADING, payload: false });
      }
    },

    // Удаление товара из корзины
    removeCartItem: async (itemIndex) => {
      if (!state.isAuth) return;

      dispatch({ type: types.SET_LOADING, payload: true });

      try {
        const { data } = await api.delete(`/cart/remove/${itemIndex}`);

        if (data.success && data.cart) {
          dispatch({ type: types.SET_CART, payload: data.cart });
          dispatch({
            type: types.SET_NOTIFICATION,
            payload: {
              message: 'Товар удален из корзины',
              type: 'success'
            }
          });
        }
      } catch (error) {
        console.error('Remove cart item error:', error);
        dispatch({ 
          type: types.SET_NOTIFICATION, 
          payload: {
            message: error.response?.data?.error || 'Ошибка удаления товара из корзины',
            type: 'error'
          }
        });
      } finally {
        dispatch({ type: types.SET_LOADING, payload: false });
      }
    },

    // Очистка корзины
    clearCart: async () => {
      if (!state.isAuth) return;

      dispatch({ type: types.SET_LOADING, payload: true });

      try {
        const { data } = await api.delete('/cart/clear');

        if (data.success) {
          dispatch({ type: types.CLEAR_CART });
          dispatch({
            type: types.SET_NOTIFICATION,
            payload: {
              message: 'Корзина очищена',
              type: 'success'
            }
          });
        }
      } catch (error) {
        console.error('Clear cart error:', error);
        dispatch({ 
          type: types.SET_NOTIFICATION, 
          payload: {
            message: error.response?.data?.error || 'Ошибка очистки корзины',
            type: 'error'
          }
        });
      } finally {
        dispatch({ type: types.SET_LOADING, payload: false });
      }
    },

    // Получение категорий товаров
    loadCategories: async () => {
      try {
        const { data } = await api.get('/products/categories/all');

        if (data.success && data.categories) {
          dispatch({ type: types.SET_CATEGORIES, payload: data.categories });
        }
      } catch (error) {
        console.error('Load categories error:', error);
      }
    },

    // Установка фильтров
    setFilters: (filters) => {
      dispatch({ type: types.SET_FILTERS, payload: filters });
    },

    // Отображение уведомления
    showNotification: (message, type = 'info', duration = 3000) => {
      dispatch({
        type: types.SET_NOTIFICATION,
        payload: { message, type, duration }
      });

      // Автоматически скрываем уведомление через указанное время
      setTimeout(() => {
        dispatch({ type: types.CLEAR_NOTIFICATION });
      }, duration);
    },

    // Скрытие уведомления
    clearNotification: () => {
      dispatch({ type: types.CLEAR_NOTIFICATION });
    }
  };

  // Загружаем данные пользователя и категории при инициализации
  useEffect(() => {
    actions.loadUser();
    actions.loadCategories();
  }, []);

  // Авторизуемся через Telegram, если есть данные пользователя Telegram
  useEffect(() => {
    if (telegramUser && !state.isAuth && !state.isLoading) {
      actions.authWithTelegram();
    }
  }, [telegramUser, state.isAuth, state.isLoading]);

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
};

// Хук для использования контекста
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
