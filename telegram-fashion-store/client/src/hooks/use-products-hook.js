// client/src/hooks/useProducts.js - Хук для работы с товарами
import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import api from '../utils/api';

export const useProducts = () => {
  const { state, actions } = useAppContext();
  const { filters } = state;
  
  const [products, setProducts] = useState([]);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [availableFilters, setAvailableFilters] = useState({
    categories: [],
    sizes: [],
    colors: [],
    priceRange: { minPrice: 0, maxPrice: 10000 }
  });

  // Загрузка списка товаров с фильтрацией
  const loadProducts = useCallback(async (page = 1, limit = 10) => {
    setLoading(true);
    setError(null);

    try {
      // Формируем параметры запроса с учетом фильтров
      const params = {
        page,
        limit,
        sort: 'createdAt',
        order: 'desc'
      };

      // Добавляем фильтры, если они указаны
      if (filters.category) params.category = filters.category;
      if (filters.size) params.size = filters.size;
      if (filters.color) params.color = filters.color;
      if (filters.minPrice > 0) params.minPrice = filters.minPrice;
      if (filters.maxPrice > 0) params.maxPrice = filters.maxPrice;
      if (filters.search) params.search = filters.search;

      const { data } = await api.get('/products', { params });

      if (data.success) {
        setProducts(data.products);
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          pages: data.pagination.pages
        });
        
        // Обновляем доступные фильтры
        if (data.filters) {
          setAvailableFilters(data.filters);
          
          // Обновляем диапазон цен в глобальных фильтрах, если он еще не установлен
          if (
            (filters.minPrice === 0 || !filters.minPrice) && 
            (filters.maxPrice === 10000 || !filters.maxPrice)
          ) {
            actions.setFilters({
              minPrice: data.filters.priceRange.minPrice,
              maxPrice: data.filters.priceRange.maxPrice
            });
          }
        }
      } else {
        setError('Ошибка загрузки товаров');
      }
    } catch (err) {
      console.error('Load products error:', err);
      setError(err.response?.data?.error || 'Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  }, [filters, actions]);

  // Загрузка информации о товаре по ID
  const loadProduct = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    setProduct(null);

    try {
      const { data } = await api.get(`/products/${id}`);

      if (data.success && data.product) {
        setProduct(data.product);
      } else {
        setError('Товар не найден');
      }
    } catch (err) {
      console.error('Load product error:', err);
      setError(err.response?.data?.error || 'Ошибка загрузки товара');
    } finally {
      setLoading(false);
    }
  }, []);

  // Автоматическая загрузка товаров при изменении фильтров
  useEffect(() => {
    loadProducts(1, pagination.limit);
  }, [filters, loadProducts, pagination.limit]);

  // Функция для обновления текущей страницы пагинации
  const changePage = (page) => {
    loadProducts(page, pagination.limit);
  };

  // Функция для изменения фильтров
  const updateFilters = (newFilters) => {
    actions.setFilters(newFilters);
  };

  // Функция для добавления товара в корзину
  const addToCart = (productId, size, color, quantity = 1) => {
    actions.addToCart(productId, size, color, quantity);
  };

  return {
    products,
    product,
    loading,
    error,
    pagination,
    availableFilters,
    loadProducts,
    loadProduct,
    changePage,
    updateFilters,
    addToCart
  };
};
