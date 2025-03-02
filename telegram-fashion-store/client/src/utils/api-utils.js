// client/src/utils/api.js - Утилиты для работы с API
import axios from 'axios';

// Базовый URL API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Создаем экземпляр axios с базовым URL и заголовками
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Перехватчик запросов для добавления токена авторизации
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Перехватчик ответов для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Обработка ошибки истечения срока действия токена
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      
      // Если в ошибке есть сообщение о просроченном токене, 
      // и мы не на странице авторизации, перенаправляем на главную
      if (
        error.response.data.error && 
        error.response.data.error.includes('токен') && 
        window.location.pathname !== '/login'
      ) {
        window.location.href = '/';
      }
    }
    
    return Promise.reject(error);
  }
);

// Экспортируем экземпляр axios
export default api;

// Вспомогательные функции для работы с API

// Загрузка файлов на сервер
export const uploadFile = async (file, endpoint, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'multipart/form-data'
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const config = {
    headers,
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    }
  };
  
  try {
    const response = await axios.post(`${API_URL}/${endpoint}`, formData, config);
    return response.data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

// Загрузка нескольких файлов на сервер
export const uploadFiles = async (files, endpoint, fieldName = 'files', onProgress) => {
  const formData = new FormData();
  
  // Добавляем каждый файл в FormData
  Array.from(files).forEach((file, index) => {
    formData.append(fieldName, file);
  });
  
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'multipart/form-data'
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const config = {
    headers,
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    }
  };
  
  try {
    const response = await axios.post(`${API_URL}/${endpoint}`, formData, config);
    return response.data;
  } catch (error) {
    console.error('Upload files error:', error);
    throw error;
  }
};

// Форматирование даты для API
export const formatDateForApi = (date) => {
  if (!date) return null;
  
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Форматирование даты и времени для отображения
export const formatDateTime = (dateTime) => {
  if (!dateTime) return '';
  
  const d = new Date(dateTime);
  
  return d.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Форматирование даты для отображения
export const formatDate = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  
  return d.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Форматирование цены
export const formatPrice = (price) => {
  if (price === undefined || price === null) return '';
  
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};
